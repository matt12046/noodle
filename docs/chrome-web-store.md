# Publishing Noodle to the Chrome Web Store

Everything the store asks for, ready to copy and paste. The images are in [`docs/store/`](store/).

## 1. Build the upload

```sh
npm run package
```

This runs the tests, builds the extension and creates `noodle-<version>.zip` in the project folder. Upload that file as it is. Don't unzip it or zip the `dist` folder yourself, because the store needs `manifest.json` at the top level of the zip.

For every later update, first raise the version number in **both** `public/manifest.json` and `package.json` (for example `1.0.0` → `1.0.1`). The store rejects an upload that doesn't have a higher version, and `npm run package` stops if the two files disagree.

## 2. Set up a developer account (once)

1. Open the [Chrome Web Store Developer Dashboard](https://chrome.google.com/webstore/devconsole) and sign in with the Google account you want to publish under. It needs 2-step verification turned on.
2. Accept the developer agreement and pay the one-time US$5 registration fee.
3. Add and verify a contact email address.
4. When asked whether you're a trader, a free hobby project with no income is a **non-trader**.

## 3. Upload

In the dashboard, click **New item** and upload the zip. Then fill in the tabs below.

## 4. Store listing tab

**Description:**

> Noodle puts Formula 1 one click away. Click the icon in your toolbar and a panel drops down with:
>
> • Standings: the drivers' and constructors' championships for the current season
> • Results: the full classification of the latest Grand Prix, with gaps, places gained or lost and the fastest lap
> • News: the latest headlines from Formula1.com, BBC Sport and Autosport
>
> Pick your team and Noodle takes on its colors and highlights its drivers. It follows your system's light or dark mode, opens instantly, and keeps showing the last data it loaded when you're offline.
>
> Private by design: no account, no ads, no analytics, no tracking. Noodle doesn't read or change the pages you visit. It only downloads public F1 data and news feeds, without your cookies.
>
> Noodle is an unofficial fan project and isn't associated with Formula 1, the FIA or any team. Standings and results come from the Jolpica F1 API (CC BY-NC-SA 4.0).

**Category:** Entertainment (News & Weather also fits).

**Language:** English.

**Graphic assets** (all in `docs/store/`):

| Field | File |
| --- | --- |
| Store icon (128×128) | `store-icon-128.png` |
| Screenshots (1280×800) | `screenshot-1-team-picker.png`, `screenshot-2-standings.png`, `screenshot-3-results.png`, `screenshot-4-light-mode.png` |
| Small promo tile (440×280) | `promo-tile-440x280.png` |

The screenshots show real results from the 2023 season. If you'd rather show this season, take new ones: they must be exactly 1280×800 or 640×400.

## 5. Privacy tab

**Single purpose:**

> Noodle shows Formula 1 championship standings, the latest race results and F1 news headlines in a popup from the browser toolbar.

**Permission justification.** Noodle has one kind of permission, host permissions for three news sites. Justification:

> Noodle downloads the public RSS news feeds from www.formula1.com, feeds.bbci.co.uk and www.autosport.com to show headlines in its News tab. It only requests those feed files. It doesn't read or change any page the user visits, and it sends no cookies or personal data.

**Remote code:** No, I am not using remote code.

**Data usage:** tick **none** of the data types. Noodle collects nothing. Then tick all three statements:

- I do not sell or transfer user data to third parties, outside of the approved use cases
- I do not use or transfer user data for purposes that are unrelated to my item's single purpose
- I do not use or transfer user data to determine creditworthiness or for lending purposes

**Privacy policy URL:** a privacy policy is only required for items that handle user data, and Noodle doesn't handle any. If the form still asks for one, publish the statement below somewhere public (a public GitHub gist works) and paste its link.

> **Noodle privacy policy**
>
> Noodle doesn't collect, sell or share any personal data. It has no accounts, analytics, ads or tracking, and it doesn't read or change the pages you visit.
>
> Your team choice, your last-used tab and a short-lived copy of the latest data are stored only in your browser. They never leave your device, and removing Noodle deletes them.
>
> To show its content, Noodle downloads public data: standings and results from api.jolpi.ca, and news feeds from www.formula1.com, feeds.bbci.co.uk and www.autosport.com. These requests don't include your cookies. News thumbnails load from the publishers' image servers, and opening an article takes you to the publisher's website, where their privacy policy applies.

## 6. Distribution tab

- **Payments:** free.
- **Visibility:** **Public**. Or pick **Unlisted** to share a link with friends before anyone can find it by searching.
- **Regions:** all regions.

## 7. Submit for review

Click **Submit for review**. Reviews usually take a few days, sometimes longer for extensions with host permissions. You'll get an email when it's approved, and it goes live automatically unless you chose to publish manually. Updates go through the same review.

## Things to keep in mind

- **Keep it free.** The standings data is licensed for non-commercial use only (CC BY-NC-SA 4.0), so Noodle can't carry ads or be paid without permission from the Jolpica project. Keep the "Data: Jolpica F1" credit in the panel.
- **Trademarks.** "F1" and "Formula 1" belong to Formula One Licensing BV. Noodle says it's unofficial in its description and uses its own icon. Keep it that way, and don't add F1 or team logos.
- **News publishers.** Noodle shows headlines with a link back to the article, like any feed reader. If a publisher changes or removes its feed, that source shows "Couldn't load" and the others keep working.
- **Microsoft Edge.** The same zip can be submitted to the free [Edge Add-ons](https://partner.microsoft.com/dashboard/microsoftedge/) store.
