NER CAMPAIGN PCR SLIDES - SETUP
===============================

DELIVERABLES

NER_Slides.gs             Google Apps Script source.
appsscript.json          Apps Script manifest (V8, BigQuery v2, Drive v3,
                         Google Slides v1).
NER_Cover_Background.png Text-free cover extracted from your Amex PDF.
NER_Divider_Background.png
                         Text-free network divider extracted from your Amex PDF.
NER_Footer.png           Cartology footer extracted from your Amex PDF.
NER_Slides.test.cjs       Local tests; do not paste into Apps Script.

The Amex photographs, including the Amex creative visible on the screens, are
reused for every campaign as requested. Dynamic headings and dates change;
the advertising pictured inside those photographs does not.

ONE-TIME SETUP

1. Open your "NER - Slides - Output" folder in Google Drive on the web.
   The Drive folder ID is the part after /folders/ in its URL. A Windows H:
   path is NOT a Drive folder ID.

2. Ensure the three PNG files above have synced into that Google Drive folder.
   Keep exactly one file of each name there. Alternatively put the PNGs in
   a separate Drive folder and set ARTWORK_FOLDER_ID to its ID.

3. Create a standalone project at https://script.google.com using your
   Cartology Google account. Paste NER_Slides.gs into the default script file.
   The editor may call it Code.gs; that is fine.

4. In Project Settings, enable "Show appsscript.json manifest file in editor".
   Replace the manifest contents with the supplied appsscript.json.
   This enables the BigQuery v2, Drive v3 and Google Slides v1 advanced services.

5. NER_CONFIG.OUTPUT_FOLDER_ID is prefilled with your supplied folder ID.
   Change it if you want to use another folder. Leave ARTWORK_FOLDER_ID
   empty if the PNGs are in that same folder.
   Set PREVIEW_BOOKING_NUMBER to a real completed campaign booking number.

6. If using a standard Google Cloud project, enable the BigQuery API and
   Google Drive API and Google Slides API in that project's Cloud Console.
   The account running
   the script needs:
   - BigQuery jobs.create on the billing/project used for query jobs.
   - Read access to the development dataset and production
     cdm.dim_cartology_campaigns.
   - Dataset/table metadata access for dataset location and refresh timestamps.
   - Permission to create files in the output folder, move generated files
     into its Shared Drive, and trash interrupted generated files.
   Shared Drive file operations use Drive v3 with supportsAllDrives.
   Workspace administrators may need to approve the requested permissions.

7. Select setupNER in the editor and click Run. Approve permissions.
   It creates an eight-slide Google Slides template in the output folder.
   Its URL is printed in the execution log.
   Calling setupNER again reuses the saved template.

8. Select previewCampaign and Run. This creates a real campaign deck, not
   dummy output. It does NOT bypass the campaign-finished or data checks.
   Review its results, cover, dates and layout against BigQuery.
   If deferred, read the reason in the execution log and resolve it.
   A completed preview is recorded and will not be duplicated by the schedule.

9. Run installDailyTrigger when satisfied. It schedules runFinishedCampaigns
   at approximately 9 AM Australia/Sydney every day, under your account.
   Change this trigger in Apps Script's Triggers page if the SQL refreshes
   finish later. Run runFinishedCampaigns manually whenever needed.
   Review Executions and Google trigger failure notifications for errors.

WHAT IS GENERATED

- One Google Slides deck per booking_number, saved in the output folder.
- Cover: brand(s), screen name(s), and the earliest/latest in-store media
  dates across the reported in-store and digital media. Dates come from
  media_start_date/media_end_date,
  NOT campaign_item_start_date/campaign_item_end_date.
- Investment/media schedule: all distinct available schedule rows. Unavailable
  Booking Type, Material Deadline, Quantity, Sales Price and Gross Media Cost
  are explicitly "Not supplied". Active store count is NOT booked quantity.
  Banner shows "Supers" for Supermarkets; Ad Format uses media_type, not media.
  The Channel column is widened to keep its heading and values on one line.
- For each media_type / campaign_item_lead_brand group:
  - A Media Results divider showing retailer and exact media_type.
  - Overall performance by period, including the source TOTAL.
  - Lifestage segments.
  - Price segments.
  - State and Metro/Regional split.
  - State only.
- A single digital section combines all digital media types, showing
  Campaign Period, Line Name, Media Type, Total Impressions, Digital Clicks
  and CTR. CTR is clicks divided by impressions, displayed as a percentage
  to two decimal places. It is N/A when impressions are zero.
  Campaign Period is promotion_week from the digital reporting table and
  can differ from the actual media dates shown on the cover and schedule.
  Each source row is shown separately. No digital total or aggregation is
  calculated: the source metadata join may produce multiple rows per line.
  Only digital lines present in the master omnichannel table are displayed.
  Other booked lines from campaign metadata are NOT added as missing rows.
  The digital SQL maps met.frequency to digital_clicks; showing it as clicks
  relies on the business confirmation that this field represents clicks.
  Digital source and campaign lines must match by booking_number, media_type
  and line_name. A source result without a matching campaign line, missing
  campaign media dates, or invalid values within a returned result
  blocks/defers the campaign rather than attributing or inventing data.
- Two in-store media groups normally produce 14 slides, matching the PDF structure.
  The state/Metro/Regional table uses a more compact layout and font down
  to 5.5 pt to fit on one slide when possible. If it still cannot fit, it
  continues on additional slides. Other large tables paginate as before.
  No rows are omitted; page numbers are regenerated.
  The combined digital table also compacts to fit on one slide when possible;
  exceptionally large digital tables continue across multiple slides.
  Multiple lead brands within one media_type get separate result sections
  within the same deck to avoid incorrectly summing deduplicated metrics.
- The default SCREEN_NAMES map labels Digital Screens Supers and Metro
  Digital Screens as FOS Screens on the cover, as in the supplied example.
  Other media types use their actual media_type. Edit this small map if
  your preferred cover screen names differ. Result sections retain media_type.
- All dynamic text and result cells remain editable in Google Slides.
  Photographs, logos, gradient and dot pattern are background artwork.
  Table cells are drawn in bounded Slides API batches to avoid hundreds
  of individual Apps Script drawing calls per campaign.

SOURCE TABLES (READ ONLY)

All slide performance values are read exclusively from:
gcp-wow-cart-data-dev-d4d7.vkondoori.
  ner_master_omnichannel_performance_impressions

The environment field separates In-Store and Digital. In-Store uses brand
as campaign_item_lead_brand; Digital uses dimension_primary as Campaign
Period and total_impressions as impressions. No metrics are read directly
from the intermediate final tables listed below.

Supporting tables (media-date metadata and/or refresh timestamps only):
gcp-wow-cart-data-dev-d4d7.vkondoori.
  ner_campaign_details_supers_and_metro_instore
  ner_bigw_instore_campaign_details
  ner_supers_metro_instore_campaign_performance_final
  ner_bigw_instore_campaign_performance_final
  ner_supers_bigw_combined_instore_impressions_final
  ner_supers_digital_impressions
  ner_bigw_digital_impressions
  ner_supers_bigw_digital_combined_impressions_final

gcp-wow-cart-data-prod-d710.cdm.dim_cartology_campaigns

The script does not change or execute your SQL pipelines. Run the Supers/
Metro in-store, BIG W in-store, and digital impressions scripts first;
then run the updated final table consolidation script last.
The BigQuery job location is detected from your development dataset.
Queries default to a 5 GB maximum bytes billed limit. An explicit BigQuery
error is surfaced if this is insufficient; increase MAXIMUM_BYTES_BILLED
only after checking the relevant query costs.

CAMPAIGN FINISHED AND DATA CHECKS

- The latest media_end_date across ALL dim_cartology_campaigns rows for
  that booking must be strictly before today's Sydney date. A campaign
  ending today is not treated as finished.
- This includes other booked media outside the in-store reporting scope,
  so an early-finishing in-store line cannot trigger a still-live campaign.
- Null, invalid or reversed media dates block generation with a log warning.
- The cover dates describe the in-store lines actually reported; the
  completion gate considers the entire booking.
- Source performance tables must have refreshed after the final campaign
  day and no earlier than the campaign detail tables.
- The union must have refreshed no earlier than each relevant performance
  table, including the digital source tables for digital media.
  The master must have refreshed no earlier than the relevant union.
  Missing refresh metadata blocks generation.
- Every expected in-store media/brand group needs all five result sections,
  an exact match to its scheduled in-store media periods, and exactly one
  TOTAL row.
- Counts and frequencies come directly from the final table. Period reach,
  store counts and frequency are NOT summed to derive TOTALs.
- BIG W's 1.6 multiplier is already in your SQL and is NOT applied again.
- Result tables exclude rows whose segment, state, or applicable
  Metro/Regional label is NULL, blank, or "Unmapped" (case-insensitive).
  If no mapped rows remain, the slide says "No mapped results available".
  The source period TOTAL remains unchanged and may therefore exceed the
  sum of displayed mapped rows; the underlying BigQuery tables are unchanged.
- Null frequency from zero EDR reach is displayed as N/A.

IMPORTANT DATA LIMITATION

The supplied tables have no authoritative "all upstream transactions fully
loaded" watermark. Refresh timestamps and period checks prevent obvious
staleness but cannot prove ingestion completeness. Schedule generation after
the upstream data has fully landed. An authoritative completion/watermark
table would be needed for a stronger guarantee.

The supplied PDF also contains at least one apparent inconsistency in its
Metro state-only total-impressions values. The generator does not copy the
PDF's numbers or correct your SQL; it uses the final BigQuery table.

OPERATIONS / TEMPLATE EDITING

- Completed bookings are recorded in Script properties as
  NER_CAMPAIGN_<encoded booking_number>. Later scheduled runs skip them.
- Existing completed decks are not updated automatically with newly added
  digital sections; regenerate those bookings using the instructions below.
- Newly arriving master-table results do not automatically update completed
  decks. Refresh the SQL tables and regenerate that booking as described below.
- Historical completed bookings in the eligible detail tables are included,
  not just campaigns that finish after installation. Preview one booking
  first. MAX_CAMPAIGNS_PER_RUN defaults to 2; historical backfill may therefore
  take multiple runs/days. Increase cautiously within Apps Script quotas.
- At about four minutes the loop stops starting new campaigns. BigQuery
  polling is bounded; pagination still depends on normal Apps Script limits.
- A script lock prevents concurrent campaign runs. Failed builds are not
  marked complete. On retry, only the previously recorded, ownership-marked
  incomplete generated deck is trashed and rebuilt. Source documents and the
  reusable template are never trashed by recovery.
- If an interrupted deck was manually deleted or its description changed,
  recovery fails explicitly. Review that booking's Script property and
  incomplete output manually rather than deleting unrelated files.
- For an intentional regeneration after data correction: archive/trash the
  old output yourself, then delete ONLY that booking's NER_CAMPAIGN_ property
  in Project Settings > Script properties. Run previewCampaign again.
  Completed decks are deliberately not silently overwritten on later data
  refreshes or booking revisions.
- Edit fonts/artwork in the generated template if desired. Keep all eight
  prototype slides, their order, speaker-note NER_TEMPLATE_ROLE markers,
  {{...}} tokens and named dynamic text shapes. Result table content is
  drawn by the script; edit its column definitions to change table design.
- To rebuild the template: archive its old deck and delete only the
  NER_TEMPLATE_ID Script property, then rerun setupNER.
- To stop automation, remove the runFinishedCampaigns trigger from the
  Apps Script Triggers page.

VALIDATION

Local tests use Node's built-in runner and mocked Google services:
  node --test "NER_Slides.test.cjs"

They exercise mixed and digital-only campaigns, master-table source selection,
digital clicks and impressions, completion gating, freshness, missing data, source
TOTAL preservation, BIG W formatting, pagination, 14-slide generation,
placeholder replacement, duplicate prevention, interrupted-build recovery,
Google Slides paragraph terminators, BigQuery polling/pagination, numeric
guards and trigger idempotence.

These are not a live Google integration test. The script has not been run
against your authenticated BigQuery/Google Slides account here. The first
authorized preview is required to verify permissions, actual table data,
Google rendering, and service quotas in your environment.
