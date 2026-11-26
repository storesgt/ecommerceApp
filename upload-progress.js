(() => {
  function open(title, stages) {
    const dialog = document.createElement('dialog');
    dialog.className = 'upload-progress-dialog';
    const stageNames = stages.length ? stages : ['Submitting'];
    dialog.innerHTML = `<section class="upload-progress-card" aria-labelledby="uploadProgressTitle"><header><span class="upload-progress-mark" aria-hidden="true">↗</span><div><p class="upload-progress-kicker">PLEASE WAIT</p><h2 id="uploadProgressTitle"></h2></div></header><p class="upload-progress-detail" aria-live="polite">Getting everything ready…</p><div class="upload-progress-track"><span></span></div><div class="upload-progress-meta"><span class="upload-progress-current">Preparing</span><strong>0%</strong></div><ol class="upload-progress-stages"></ol><p class="upload-progress-error" role="alert" hidden></p><button class="upload-progress-close" type="button" hidden>Done</button></section>`;
    dialog.querySelector('#uploadProgressTitle').textContent = title;
    const list = dialog.querySelector('.upload-progress-stages');
    list.innerHTML = stageNames.map((name, index) => `<li data-stage="${index}"><span class="upload-progress-stage-icon" aria-hidden="true"></span><span>${name}</span></li>`).join('');
    const track = dialog.querySelector('.upload-progress-track span');
    const percentage = dialog.querySelector('.upload-progress-meta strong');
    const currentLabel = dialog.querySelector('.upload-progress-current');
    const detail = dialog.querySelector('.upload-progress-detail');
    const error = dialog.querySelector('.upload-progress-error');
    const closeButton = dialog.querySelector('.upload-progress-close');
    let activeStage = 0;
    let finished = false;

    const close = () => {
      if (!finished) return;
      if (dialog.open) dialog.close();
      dialog.remove();
    };
    const setStage = (index, progress = null, message = '') => {
      activeStage = Math.max(0, Math.min(index, stageNames.length - 1));
      const indeterminate = progress === null;
      const boundedProgress = indeterminate ? 0 : Math.max(0, Math.min(100, Number(progress) || 0));
      [...list.children].forEach((item, itemIndex) => {
        item.classList.toggle('is-complete', itemIndex < activeStage || (itemIndex === activeStage && boundedProgress >= 100));
        item.classList.toggle('is-active', itemIndex === activeStage && (indeterminate || boundedProgress < 100));
        item.classList.toggle('is-pending', itemIndex > activeStage);
      });
      const totalProgress = Math.round(((activeStage + boundedProgress / 100) / stageNames.length) * 100);
      dialog.querySelector('.upload-progress-track').classList.toggle('is-indeterminate', indeterminate);
      track.style.width = `${totalProgress}%`;
      percentage.textContent = indeterminate ? '…' : `${totalProgress}%`;
      currentLabel.textContent = stageNames[activeStage];
      detail.textContent = message || (indeterminate ? 'Working…' : boundedProgress ? `${Math.round(boundedProgress)}% complete` : 'Working…');
    };
    const complete = (message = 'Everything is up to date.') => {
      finished = true;
      [...list.children].forEach((item) => {
        item.classList.remove('is-active', 'is-pending', 'is-error');
        item.classList.add('is-complete');
      });
      track.style.width = '100%';
      dialog.querySelector('.upload-progress-track').classList.remove('is-indeterminate');
      percentage.textContent = '100%';
      currentLabel.textContent = 'Complete';
      detail.textContent = message;
      dialog.querySelector('.upload-progress-mark').textContent = '✓';
      dialog.querySelector('.upload-progress-mark').classList.add('is-success');
      closeButton.hidden = false;
    };
    const fail = (message) => {
      finished = true;
      const currentItem = list.children[activeStage];
      currentItem?.classList.remove('is-active');
      currentItem?.classList.add('is-error');
      currentLabel.textContent = 'Needs attention';
      detail.textContent = 'This submission could not be completed.';
      error.textContent = message || 'Please try again.';
      error.hidden = false;
      dialog.querySelector('.upload-progress-mark').textContent = '!';
      dialog.querySelector('.upload-progress-mark').classList.add('is-error');
      closeButton.textContent = 'Close';
      closeButton.hidden = false;
    };
    closeButton.addEventListener('click', close);
    dialog.addEventListener('cancel', (event) => {
      if (!finished) event.preventDefault();
      else close();
    });
    dialog.addEventListener('click', (event) => {
      if (event.target === dialog && finished) close();
    });
    document.body.append(dialog);
    dialog.showModal();
    closeButton.focus();
    return { setStage, complete, fail, close };
  }

  function upload(url, formData, headers = {}, onProgress = () => {}) {
    return new Promise((resolve, reject) => {
      const request = new XMLHttpRequest();
      request.open('POST', url);
      Object.entries(headers).forEach(([name, value]) => request.setRequestHeader(name, value));
      request.upload.addEventListener('progress', (event) => {
        if (event.lengthComputable) onProgress(Math.round((event.loaded / event.total) * 100), event.loaded, event.total);
      });
      request.addEventListener('load', () => {
        let payload = {};
        try {
          payload = JSON.parse(request.responseText || '{}');
        } catch {
          payload = {};
        }
        if (request.status < 200 || request.status >= 300) {
          reject(new Error(payload.error || payload.message || `Upload failed (${request.status})`));
          return;
        }
        resolve(payload);
      });
      request.addEventListener('error', () => reject(new Error('Network error while uploading. Check your connection and try again.')));
      request.addEventListener('abort', () => reject(new Error('Upload was cancelled.')));
      request.send(formData);
    });
  }

  window.UploadProgressUI = { open, upload };
})();
