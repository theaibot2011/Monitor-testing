# MonitorTest: free, detailed monitor check

A guided check of a computer monitor that anyone can do with their own eyes: lines and stripes, dead and stuck pixels, light leaks, evenness, colour fades, dark and bright detail, sharpness, viewing angles, burn-in, motion, refresh rate and the physical condition. It ends with a report you can print, save as a picture or send. Built for buying, selling, checking after a repair, or checking your own monitor.

Everything runs in the browser. Nothing is uploaded, there is no tracking, and it works offline after the first visit.

## Run locally

1. Install **Node.js 20** from nodejs.org (the "LTS" download is fine).
2. Open a terminal in this folder and run:
   ```bash
   npm install
   ```
3. Start the app:
   ```bash
   npm run dev
   ```
4. Open the address it prints (usually http://localhost:5173) in Chrome or Edge.

Optional checks for developers: `npm run test` runs the unit tests. `npm run test:e2e` runs the browser tests in Chromium, Firefox and WebKit, including an accessibility scan (run `npx playwright install` once first).

## Deploy by drag-and-drop (Netlify Drop)

1. In this folder, run:
   ```bash
   npm install
   ```
   ```bash
   npm run build
   ```
2. This creates a folder called `dist`.
3. To update an existing site and keep its address: open the site on app.netlify.com, go to **Deploys**, and drag the `dist` folder into the box. For a brand-new site, drag it onto https://app.netlify.com/drop.
4. Open the address once on the testing computer. After that it also works offline.

If your site address is not `monitortesting.netlify.app`, change `VITE_SITE_URL` in the `.env` file and build again (it makes link previews show the right picture).

## Deploy via GitHub

1. Put this folder in a GitHub repository (the `.gitignore` already leaves out `node_modules` and `dist`).
2. In Netlify choose **Add new site → Import an existing project → GitHub**, and pick the repository.
3. Leave every setting as it is. `netlify.toml` already tells Netlify to run `npm run build`, publish `dist` and use Node 20. Security headers are written to `dist/_headers` during the build.
4. Press **Deploy**. Every push to GitHub updates the site automatically.
