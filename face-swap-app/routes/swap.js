const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const router = express.Router();

const allowedMimeTypes = new Set(['image/jpeg', 'image/png']);
const maxFileSize = 8 * 1024 * 1024; // 8MB each

const uploadDir = path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const safeBaseName = path
      .basename(file.originalname, ext)
      .replace(/[^a-z0-9-_]/gi, '_')
      .slice(0, 50);
    cb(null, `${Date.now()}-${safeBaseName}${ext}`);
  },
});

const fileFilter = (_req, file, cb) => {
  if (!allowedMimeTypes.has(file.mimetype)) {
    return cb(new Error('Invalid file type. Only JPG and PNG are allowed.'));
  }
  cb(null, true);
};

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: maxFileSize,
    files: 2,
  },
});

function toInlineData(filePath, mimeType) {
  const data = fs.readFileSync(filePath);
  return {
    mimeType,
    data: data.toString('base64'),
  };
}

async function callGeminiSwap({ thumbnailPath, thumbnailType, portraitPath, portraitType, styleInstructions }) {
  const apiKey = process.env.GEMINI_API_KEY;
  const model = process.env.GEMINI_MODEL || 'gemini-3-pro-image-preview';

  if (!apiKey || apiKey === 'your_gemini_api_key_here') {
    throw new Error('Missing GEMINI_API_KEY in .env.');
  }

  const prompt = `Replace the face in the first image with the face from the second image. Ensure realistic blending, correct lighting, natural skin tones, perspective alignment, and seamless integration. Keep the original thumbnail composition and background intact. Generate a single final image in exact 16:9 landscape format (e.g. 1920x1080) with no borders, no text overlays, and no collage layout. Style: ${styleInstructions || 'YouTube thumbnail style with natural realism'}.`;

  const payload = {
    contents: [
      {
        role: 'user',
        parts: [
          { text: prompt },
          { inlineData: toInlineData(thumbnailPath, thumbnailType) },
          { inlineData: toInlineData(portraitPath, portraitType) },
        ],
      },
    ],
    generationConfig: {
      temperature: 0.4,
    },
  };

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    }
  );

  const data = await response.json();

  if (!response.ok) {
    const message = data?.error?.message || 'Gemini API request failed.';
    throw new Error(message);
  }

  const parts = data?.candidates?.[0]?.content?.parts || [];
  const imagePart = parts.find((part) => part.inlineData?.data);

  if (!imagePart?.inlineData?.data) {
    throw new Error('Gemini did not return an image. Try another prompt or image pair.');
  }

  return {
    mimeType: imagePart.inlineData.mimeType || 'image/png',
    base64: imagePart.inlineData.data,
  };
}

router.post(
  '/swap-face',
  upload.fields([
    { name: 'thumbnail', maxCount: 1 },
    { name: 'portrait', maxCount: 1 },
  ]),
  async (req, res) => {
    const uploadedFiles = [];

    try {
      const thumbnail = req.files?.thumbnail?.[0];
      const portrait = req.files?.portrait?.[0];

      if (!thumbnail || !portrait) {
        return res.status(400).json({ error: 'Both thumbnail and portrait images are required.' });
      }

      uploadedFiles.push(thumbnail.path, portrait.path);

      const styleInstructions = (req.body.instructions || '').trim();

      const result = await callGeminiSwap({
        thumbnailPath: thumbnail.path,
        thumbnailType: thumbnail.mimetype,
        portraitPath: portrait.path,
        portraitType: portrait.mimetype,
        styleInstructions,
      });

      return res.status(200).json({
        message: 'Face swap generated successfully.',
        image: `data:${result.mimeType};base64,${result.base64}`,
        mimeType: result.mimeType,
      });
    } catch (error) {
      console.error('Face swap error:', error);
      return res.status(500).json({ error: error.message || 'Face swap failed.' });
    } finally {
      for (const filePath of uploadedFiles) {
        fs.promises.unlink(filePath).catch(() => {});
      }
    }
  }
);

router.use((err, _req, res, _next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ error: 'File too large. Max 8MB per image.' });
    }
    return res.status(400).json({ error: err.message });
  }

  return res.status(400).json({ error: err.message || 'Upload failed.' });
});

module.exports = router;
