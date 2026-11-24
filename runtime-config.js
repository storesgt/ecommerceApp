(() => {
  const localApiOrigin = 'http://localhost:4000';
  const originalFetch = window.fetch.bind(window);

  window.fetch = (resource, options) => {
    if (typeof resource === 'string' && resource.startsWith(localApiOrigin)) {
      resource = resource.slice(localApiOrigin.length) || '/';
    }
    return originalFetch(resource, options);
  };
})();
