// Keep native form submission disabled while the Firebase modules load. A slow
// or failed import must never put a password in a URL or submit it to Hosting.
(function () {
  const form = document.getElementById('authForm');
  form.addEventListener('submit', event => event.preventDefault());
  import('/js/social-auth.js').catch(error => {
    document.getElementById('authStatus').textContent = 'Sign-in could not load. Check your connection and refresh to try again.';
    console.error('Could not load sign-in', error);
  });
})();
