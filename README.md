# NER Slides Generation

An automated Google Apps Script solution for generating Near Endemic Report (NER) campaign presentation slides from BigQuery data.

## Overview

This project automates the creation of professional Google Slides presentations for NER (Near Endemic Report) campaigns. It integrates with Google Slides, Google Drive, and BigQuery to fetch campaign data and generate formatted presentation decks.

## Features

- **Automated Slide Generation**: Creates complete presentation decks from campaign data stored in BigQuery
- **Dynamic Content**: Automatically populates slides with current campaign metrics, media schedules, and performance data
- **Multi-Media Support**: Handles both in-store and digital media types
- **Professional Formatting**: Uses custom templates with artwork, branding, and consistent styling
- **BigQuery Integration**: Fetches real-time performance metrics and campaign details
- **Daily Automation**: Scheduled daily triggers to generate completed campaigns automatically
- **Comprehensive Reporting**: Includes covers, dividers, media schedules, performance breakdowns by:
  - Lifestage segments
  - Price segments
  - Geographic regions (State, Metro/Regional)
  - Media types

## Prerequisites

- Google Account with Google Drive access
- Google Apps Script access
- BigQuery project access with proper dataset permissions
- The following Google services enabled:
  - Google Slides API (v1)
  - Google Drive API (v3)
  - BigQuery API (v2)

## Installation

### Quick Start

1. **Create a Google Apps Script Project**
   - Go to [script.google.com](https://script.google.com)
   - Create a new standalone project
   - Copy the contents of `NER_Slides.gs` into the default script file

2. **Configure the Manifest**
   - In Project Settings, enable "Show appsscript.json manifest file in editor"
   - Replace the manifest with the contents of `appsscript.json`
   - This enables the required BigQuery, Drive, and Slides APIs

3. **Set Up Image Assets**
   - Create a Google Drive folder for the NER campaign output
   - Upload the PNG files (`NER_Cover_Background.png`, `NER_Divider_Background.png`, `NER_Footer.png`) to this folder
   - Note your folder ID from the Drive URL (`/folders/FOLDER_ID`)

4. **Configure Script Properties**
   - Update `NER_CONFIG.OUTPUT_FOLDER_ID` with your Drive folder ID
   - Set `PREVIEW_BOOKING_NUMBER` to a real completed campaign booking number for testing

5. **Run Setup**
   - Select `setupNER` function in the editor
   - Click Run and approve requested permissions
   - This creates the template presentation

6. **Test with Preview**
   - Select `previewCampaign` function
   - Click Run to generate a sample campaign deck
   - Review the results

7. **Enable Daily Automation**
   - Run `installDailyTrigger` to schedule `runFinishedCampaigns`
   - Runs daily at ~9 AM Australia/Sydney time

## Project Structure

```
NER_Slides_Generation/
├── NER_Slides.gs               # Main Google Apps Script source code
├── NER_Slides.test.cjs         # Local Node.js tests
├── appsscript.json             # Apps Script manifest with API config
├── NER_Cover_Background.png    # Cover slide artwork
├── NER_Divider_Background.png  # Divider slide artwork
├── NER_Footer.png              # Footer artwork
├── SETUP.md                    # Detailed setup instructions
└── README.md                   # This file
```

## Configuration

Key configuration options in the script (adjust as needed):

- `OUTPUT_FOLDER_ID`: Google Drive folder for generated presentations
- `ARTWORK_FOLDER_ID`: Optional separate folder for PNG assets (leave empty to use `OUTPUT_FOLDER_ID`)
- `PREVIEW_BOOKING_NUMBER`: Sample booking number for testing
- `MAXIMUM_BYTES_BILLED`: BigQuery quota limit (default: 5 GB)
- `MAX_CAMPAIGNS_PER_RUN`: Maximum campaigns to generate per scheduled run (default: 2)

## Data Sources

The script reads campaign and performance data from BigQuery:

**Primary Data Source:**
- `gcp-wow-cart-data-dev-d4d7.vkondoori.ner_master_omnichannel_performance_impressions`

**Supporting Tables:**
- Campaign details (in-store and digital)
- Campaign performance metrics (by period, segment, state)
- Digital impressions and clicks
- Cartology campaign metadata (`cdm.dim_cartology_campaigns`)

See `SETUP.md` for complete table documentation.

## Usage

### Generate a Single Campaign Preview

```javascript
// In Apps Script editor, select and run:
previewCampaign()
```

### Run Scheduled Campaign Generation

```javascript
// In Apps Script editor, select and run:
runFinishedCampaigns()
```

This generates presentations for all completed campaigns that haven't been processed yet.

### Create or Rebuild Template

```javascript
// In Apps Script editor, select and run:
setupNER()
```

### Manage Automation

- **Enable Daily Trigger**: Run `installDailyTrigger()`
- **View/Disable Trigger**: Go to Apps Script > Triggers page and manage `runFinishedCampaigns` trigger
- **Force Regeneration**: Delete the corresponding `NER_CAMPAIGN_<booking_number>` property in Project Settings > Script properties, then rerun

## Testing

Local tests are provided for Node.js environments:

```bash
node --test NER_Slides.test.cjs
```

**Note**: Local tests use mocked Google services and don't require authentication. The first authorized preview run is recommended to verify permissions and actual data.

## Completion Criteria

Campaigns are only processed when:

1. **Campaign Finished**: The latest `media_end_date` is strictly before today (Sydney time)
2. **Data Complete**: All supporting tables have refreshed after the final campaign day
3. **Results Available**: All expected media/brand groups have complete result sections
4. **Data Valid**: No null, invalid, or reversed media dates

## Outputs

Generated presentations include:

- **Cover Slide**: Brand, screen names, media date range
- **Investment Schedule**: Media booking details, quantities, pricing
- **Performance Sections** (per media type):
  - Overall performance by period
  - Lifestage segment breakdown
  - Price segment breakdown
  - State and Metro/Regional analysis
- **Digital Section**: Unified digital media metrics (if applicable)

Tables automatically paginate and optimize formatting for readability.

## Important Notes

### Data Limitations

- The supplied tables lack an authoritative "data fully loaded" watermark
- Refresh timestamps prevent obvious staleness but cannot guarantee ingestion completeness
- Schedule generation after upstream data has fully landed
- The supplied PDF may contain inconsistencies not corrected by this script

### Template Editing

- Keep all 8 prototype slides and their order
- Maintain `{{...}}` placeholder tokens and named dynamic text shapes
- Speaker notes contain `NER_TEMPLATE_ROLE` markers—do not remove
- Edit table column definitions to change table design
- Result tables are drawn via API; photographs and artwork are backgrounds

### File Management

- Completed bookings are recorded in Script properties to prevent duplication
- Failed builds are not marked complete; they retry on next run
- Use folder archiving/trashing for intentional regenerations
- Generated decks are not silently overwritten on data refresh

## Support

For issues related to:

- **Setup or permissions**: Check `SETUP.md` for detailed instructions
- **Data problems**: Verify BigQuery tables refresh times and content
- **Template changes**: Review the "Template Editing" section above
- **Performance**: Check Apps Script Executions and function logs

## License

[Include appropriate license if applicable]

## Contributing

This is a production system. For changes or improvements:

1. Test thoroughly in a non-production environment
2. Document any configuration changes
3. Update relevant documentation
4. Verify BigQuery permissions and data consistency
5. Run preview on a known-good booking before enabling automation

## Related Documentation

- [Google Apps Script Documentation](https://developers.google.com/apps-script)
- [Google Slides API](https://developers.google.com/slides)
- [BigQuery Documentation](https://cloud.google.com/bigquery/docs)
- [Google Drive API](https://developers.google.com/drive)

---

**Last Updated**: 2026-11-19  
**Version**: 1.0  
**Maintainer**: Varsha Kondoori
