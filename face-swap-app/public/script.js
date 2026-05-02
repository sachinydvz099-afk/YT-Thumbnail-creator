const form = document.getElementById('swapForm');
const thumbnailInput = document.getElementById('thumbnailInput');
const portraitInput = document.getElementById('portraitInput');
const thumbnailPreview = document.getElementById('thumbnailPreview');
const portraitPreview = document.getElementById('portraitPreview');
const instructionsInput = document.getElementById('instructions');
const statusEl = document.getElementById('status');
const loadingEl = document.getElementById('loading');
const outputImage = document.getElementById('outputImage');
const thumbnailMirror = document.getElementById('thumbnailMirror');
const portraitMirror = document.getElementById('portraitMirror');
const downloadBtn = document.getElementById('downloadBtn');
const generateBtn = document.getElementById('generateBtn');

const MAX_SIZE = 8 * 1024 * 1024;
const VALID_TYPES = ['image/jpeg', 'image/png'];

function setStatus(message = '', isError = true) {
  statusEl.textContent = message;
  statusEl.style.color = isError ? '#ff7b7b' : '#8ef3be';
}

function validateFile(file) {
  if (!file) return 'Please select an image file.';
  if (!VALID_TYPES.includes(file.type)) return 'Only JPG/PNG files are supported.';
  if (file.size > MAX_SIZE) return 'File exceeds 8MB limit.';
  return null;
}

function renderPreview(file, imgEl, mirrorEl) {
  const url = URL.createObjectURL(file);
  imgEl.src = url;
  imgEl.classList.remove('hidden');
  if (mirrorEl) {
    mirrorEl.src = url;
    mirrorEl.classList.remove('hidden');
  }
}

function attachPreview(inputEl, imgEl, mirrorEl) {
  inputEl.addEventListener('change', () => {
    const [file] = inputEl.files;
    const error = validateFile(file);
    if (error) {
      setStatus(error, true);
      inputEl.value = '';
      imgEl.classList.add('hidden');
      return;
    }
    setStatus('');
    renderPreview(file, imgEl, mirrorEl);
  });
}

attachPreview(thumbnailInput, thumbnailPreview, thumbnailMirror);
attachPreview(portraitInput, portraitPreview, portraitMirror);

for (const box of document.querySelectorAll('.upload-box')) {
  const input = document.getElementById(box.dataset.input);

  box.addEventListener('dragover', (e) => {
    e.preventDefault();
    box.classList.add('dragover');
  });

  box.addEventListener('dragleave', () => box.classList.remove('dragover'));

  box.addEventListener('drop', (e) => {
    e.preventDefault();
    box.classList.remove('dragover');

    const file = e.dataTransfer.files?.[0];
    const error = validateFile(file);
    if (error) {
      setStatus(error, true);
      return;
    }

    const dataTransfer = new DataTransfer();
    dataTransfer.items.add(file);
    input.files = dataTransfer.files;
    input.dispatchEvent(new Event('change'));
  });
}

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  setStatus('');

  const thumbnail = thumbnailInput.files[0];
  const portrait = portraitInput.files[0];

  const thumbnailError = validateFile(thumbnail);
  if (thumbnailError) return setStatus(`Thumbnail: ${thumbnailError}`);

  const portraitError = validateFile(portrait);
  if (portraitError) return setStatus(`Portrait: ${portraitError}`);

  loadingEl.classList.remove('hidden');
  generateBtn.disabled = true;

  try {
    const formData = new FormData();
    formData.append('thumbnail', thumbnail);
    formData.append('portrait', portrait);
    formData.append('instructions', instructionsInput.value.trim());

    const response = await fetch('/api/swap-face', {
      method: 'POST',
      body: formData,
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Face swap request failed.');
    }

    outputImage.src = data.image;
    outputImage.classList.remove('hidden');
    downloadBtn.href = data.image;
    downloadBtn.classList.remove('hidden');
    setStatus('Generated successfully!', false);
  } catch (error) {
    setStatus(error.message || 'Unexpected error occurred.');
  } finally {
    loadingEl.classList.add('hidden');
    generateBtn.disabled = false;
  }
});
