# Solar field guide

A static solar calculator and plain-language guide for Pakistani homeowners.

## Publish with GitHub Pages

1. Create an empty GitHub repository. Do not add a README, license, or other starter files.
2. In PowerShell, open this folder and run:

   ```powershell
   git init -b main
   git add .gitignore README.md index.html app.js styles.css base.css tokens.css .github/workflows/pages.yml
   git commit -m "Prepare solar guide for GitHub Pages"
   git remote add origin https://github.com/YOUR-USERNAME/YOUR-REPOSITORY.git
   git push -u origin main
   ```

3. On GitHub, open the repository's **Settings → Pages** and set the build and deployment source to **GitHub Actions**.
4. Open the **Actions** tab and wait for **Deploy static site to GitHub Pages** to finish.
5. Find the published URL under **Settings → Pages**. It normally looks like `https://YOUR-USERNAME.github.io/YOUR-REPOSITORY/`.

The workflow publishes only `index.html`, `app.js`, and the three CSS files. Project analysis notes and `.hallmark` files are excluded from Git and from the deployed site. A GitHub Pages website is public on the internet, so do not add private information to the published files.

After you know the public URL, update the page's canonical URL and add a sitemap/robots file using that exact domain.
