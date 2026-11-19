# Quick Start Guide - NER Slides Generation

## 5-Minute Setup

1. **Copy the script to Google Apps Script**
   - Go to [script.google.com](https://script.google.com)
   - Create a new standalone project
   - Copy-paste all contents from `NER_Slides.gs` into your script editor

2. **Enable the APIs**
   - Project Settings → Show appsscript.json manifest
   - Replace with the contents of `appsscript.json` (BigQuery, Slides, Drive v1-v3)

3. **Upload your assets to Google Drive**
   - Create a folder in Google Drive named "NER - Slides - Output"
   - Upload the three PNG files there:
     - `NER_Cover_Background.png`
     - `NER_Divider_Background.png`
     - `NER_Footer.png`
   - Copy the folder ID from the URL (the part after `/folders/`)

4. **Configure the script**
   - In `NER_CONFIG` at the top of `NER_Slides.gs`:
     - Set `OUTPUT_FOLDER_ID` to your folder ID
     - Leave `ARTWORK_FOLDER_ID` empty (will use same folder)
     - Set `PREVIEW_BOOKING_NUMBER` to a real booking number

5. **Create the template**
   - In the script editor, select the `setupNER` function
   - Click the ▶ Run button
   - Approve the permission prompts
   - Check the Executions tab for the generated template URL

6. **Test it out**
   - Select `previewCampaign` function
   - Click Run
   - A new presentation should appear in your Google Drive folder

7. **Enable automation (optional)**
   - Run `installDailyTrigger` to schedule daily campaign generation
   - Runs at ~9 AM Sydney time each day
   - Manage or disable in Triggers tab anytime

## Troubleshooting

| Problem | Solution |
|---------|----------|
| "Folder not found" | Check that `OUTPUT_FOLDER_ID` is correct (from Drive URL) |
| "Missing PNG files" | Verify the three PNG files are uploaded to the Drive folder |
| "BigQuery permission denied" | Ensure your account has BigQuery access and APIs are enabled |
| "No campaigns to generate" | Verify `PREVIEW_BOOKING_NUMBER` is a real, completed campaign |
| "Template not found" | Run `setupNER()` first to create the template |

## Running Manually vs. Scheduled

- **Manual**: Select function in editor and click Run
- **Scheduled**: Configure via `installDailyTrigger()` or Triggers page
- **Monitor**: Check "Executions" tab for logs and errors

## Need Help?

Refer to the full documentation:
- `README.md` - Complete feature overview
- `SETUP.md` - Detailed configuration and troubleshooting
- `NER_Slides.test.cjs` - Code examples and test cases

---

**Next Step**: Run `setupNER()` to get started!
