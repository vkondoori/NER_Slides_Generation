const NER_CONFIG = {
  PROJECT_ID: 'gcp-wow-cart-data-dev-d4d7',
  DATASET_ID: 'vkondoori',
  OUTPUT_FOLDER_ID: '1xprp83XiSastZUK6_9ywZ4hCyC9Nmzwl', // Google Drive folder ID.
  ARTWORK_FOLDER_ID: '', // Leave empty to read artwork from OUTPUT_FOLDER_ID.
  PREVIEW_BOOKING_NUMBER: '',
  TIME_ZONE: 'Australia/Sydney',
  MAX_CAMPAIGNS_PER_RUN: 2,
  MAXIMUM_BYTES_BILLED: '5000000000',
  SCREEN_NAMES: {
    'Digital Screens Supers': 'FOS Screens',
    'Metro Digital Screens': 'FOS Screens'
  }
};

const NER_TABLES = {
  supersDetails: 'ner_campaign_details_supers_and_metro_instore',
  bigwDetails: 'ner_bigw_instore_campaign_details',
  supersFinal: 'ner_supers_metro_instore_campaign_performance_final',
  bigwFinal: 'ner_bigw_instore_campaign_performance_final',
  combined: 'ner_supers_bigw_combined_instore_impressions_final',
  supersDigital: 'ner_supers_digital_impressions',
  bigwDigital: 'ner_bigw_digital_impressions',
  digitalCombined: 'ner_supers_bigw_digital_combined_impressions_final',
  master: 'ner_master_omnichannel_performance_impressions'
};

const NER_DIGITAL_TYPES = {
  'Order Confirmation Page': 'Supermarkets',
  'Big W - Department Page Takeover': 'BIG W',
  'Big W - Homepage': 'BIG W',
  'Big W - Event': 'BIG W'
};

const NER_SECTIONS = [
  {order: 1, title: 'Overall Performance by Period'},
  {order: 3, title: 'Overall Performance by Lifestage Segments'},
  {order: 4, title: 'Overall Performance by Price Segments'},
  {order: 5, title: 'Overall Performance by Geographical State and Metro/Regional Split'},
  {order: 6, title: 'Overall Performance by Geographical State'}
];

const NER_TEMPLATE_KEY = 'NER_TEMPLATE_ID';
const NER_DARK = '#38474E';
const NER_GREEN = '#A5C947';

function setupNER() {
  validateConfig_();
  const templateId = createNERTemplate();
  console.log('Template ready: https://docs.google.com/presentation/d/' + templateId + '/edit');
  console.log('Set PREVIEW_BOOKING_NUMBER and run previewCampaign before installing the trigger.');
}

function createNERTemplate() {
  validateConfig_();
  const properties = PropertiesService.getScriptProperties();
  const existing = properties.getProperty(NER_TEMPLATE_KEY);
  if (existing) {
    validateTemplate_(SlidesApp.openById(existing));
    return existing;
  }
  const artwork = NER_CONFIG.ARTWORK_FOLDER_ID || NER_CONFIG.OUTPUT_FOLDER_ID;
  const assets = {
    cover: uniqueFile_(artwork, 'NER_Cover_Background.png').getBlob(),
    divider: uniqueFile_(artwork, 'NER_Divider_Background.png').getBlob(),
    footer: uniqueFile_(artwork, 'NER_Footer.png').getBlob()
  };
  const deck = SlidesApp.create('NER - Reusable PCR Template');
  const id = deck.getId();
  updateFile_(id, {description: 'NER reusable template; generated from the supplied Amex PDF artwork.'});
  moveToOutputFolder_(id);
  assertPageSize_(deck);
  const initialSlide = deck.getSlides()[0];

  const cover = deck.appendSlide(SlidesApp.PredefinedLayout.BLANK);
  cover.insertImage(assets.cover, 0, 0, 720, 405);
  textBox_(cover, '{{COVER_TITLE}}', 34, 188, 365, 45, 28, '#FFFFFF', false, 'COVER_TITLE');
  textBox_(cover, 'Media Reporting', 34, 230, 400, 29, 19, '#FFFFFF');
  textBox_(cover, 'Campaign Live Dates: {{LIVE_DATES}}', 34, 254, 405, 44, 17,
    '#FFFFFF', false, 'LIVE_DATES');
  markRole_(cover, 'cover');

  const schedule = deck.appendSlide(SlidesApp.PredefinedLayout.BLANK);
  textBox_(schedule, 'Campaign Investment Summary | Media schedule', 19, 25, 680, 42,
    21, NER_DARK, false);
  textBox_(schedule, '{{CONTINUED}}', 20, 60, 675, 16, 8, NER_DARK);
  addFooter_(schedule, assets.footer);
  markRole_(schedule, 'schedule');

  const divider = deck.appendSlide(SlidesApp.PredefinedLayout.BLANK);
  divider.insertImage(assets.divider, 0, 0, 720, 405);
  textBox_(divider, 'Media Results', 47, 232, 320, 38, 29, '#FFFFFF');
  textBox_(divider, '{{NETWORK}}', 47, 268, 320, 87, 24, '#FFFFFF', false, 'NETWORK');
  textBox_(divider, '{{PAGE_NUMBER}}', 683, 374, 18, 18, 7, NER_DARK);
  markRole_(divider, 'divider');

  NER_SECTIONS.forEach(function (section) {
    const slide = deck.appendSlide(SlidesApp.PredefinedLayout.BLANK);
    textBox_(slide, 'Media Results | ' + section.title, 19, 17, 680, 57,
      20, NER_DARK, true);
    textBox_(slide, '{{NETWORK}}', 19, 74, 680, 23, 12, NER_DARK, true, 'NETWORK');
    addFooter_(slide, assets.footer);
    markRole_(slide, 'section-' + section.order);
  });
  initialSlide.remove();
  validateTemplate_(deck);
  deck.saveAndClose();
  properties.setProperty(NER_TEMPLATE_KEY, id);
  return id;
}

function previewCampaign() {
  if (!NER_CONFIG.PREVIEW_BOOKING_NUMBER.trim()) {
    throw new Error('Set NER_CONFIG.PREVIEW_BOOKING_NUMBER to a real booking number first.');
  }
  return runCampaigns_(NER_CONFIG.PREVIEW_BOOKING_NUMBER.trim());
}

function runFinishedCampaigns() {
  return runCampaigns_(null);
}

function installDailyTrigger() {
  validateConfig_();
  if (!PropertiesService.getScriptProperties().getProperty(NER_TEMPLATE_KEY)) {
    throw new Error('Run setupNER before installing the trigger.');
  }
  const triggers = ScriptApp.getProjectTriggers().filter(function (trigger) {
    return trigger.getHandlerFunction() === 'runFinishedCampaigns';
  });
  if (triggers.length) {
    console.log('An NER trigger already exists; no duplicate trigger was installed.');
    return;
  }
  ScriptApp.newTrigger('runFinishedCampaigns').timeBased()
    .atHour(9).everyDays(1).inTimezone(NER_CONFIG.TIME_ZONE).create();
  console.log('Daily trigger installed for approximately 9 AM ' + NER_CONFIG.TIME_ZONE + '.');
}

function runCampaigns_(onlyBooking) {
  validateConfig_();
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(1000)) {
    throw new Error('Another NER generation is running. Retry after it completes.');
  }
  try {
    const started = Date.now();
    const properties = PropertiesService.getScriptProperties();
    const templateId = properties.getProperty(NER_TEMPLATE_KEY);
    if (!templateId) throw new Error('Run setupNER first.');
    const template = SlidesApp.openById(templateId);
    validateTemplate_(template);
    const parameters = onlyBooking
      ? [{name: 'booking', parameterType: {type: 'STRING'}, parameterValue: {value: onlyBooking}}]
      : [];
    const metadata = queryRows_(metadataSql_(), parameters, onlyBooking)
      .concat(queryRows_(digitalMetadataSql_(), parameters, onlyBooking));
    const campaigns = groupBy_(metadata, function (row) { return row.booking_number; });
    if (onlyBooking && !campaigns.has(onlyBooking)) {
      throw new Error('Booking not found in eligible in-store or digital campaign data: ' + onlyBooking);
    }
    const today = Utilities.formatDate(new Date(), NER_CONFIG.TIME_ZONE, 'yyyy-MM-dd');
    const summary = {created: [], skipped: [], deferred: []};
    const errors = [];
    const bookings = Array.from(campaigns.keys()).sort();
    for (const booking of bookings) {
      if (summary.created.length >= NER_CONFIG.MAX_CAMPAIGNS_PER_RUN ||
          Date.now() - started > 240000) {
        console.log('Batch limit reached; remaining campaigns will be checked on the next run.');
        break;
      }
      const rows = campaigns.get(booking);
      const ledgerKey = ledgerKey_(booking);
      const rawRecord = properties.getProperty(ledgerKey);
      const record = rawRecord ? JSON.parse(rawRecord) : null;
      if (record && record.status === 'complete') {
        summary.skipped.push({booking: booking, url: record.url});
        continue;
      }
      const reason = readinessReason_(rows, today);
      if (reason) {
        summary.deferred.push({booking: booking, reason: reason});
        console.warn('NER deferred ' + booking + ': ' + reason);
        continue;
      }
      try {
        if (record) recoverInterruptedDeck_(record, booking, properties, ledgerKey);
        const performance = queryRows_(
          'SELECT booking_number, brand AS campaign_item_lead_brand, media_type, report_section, ' +
          'section_order, dimension_primary, dimension_secondary, active_store_count, ' +
          'total_impressions, edr_impressions, edr_reach, edr_frequency FROM ' + table_(NER_TABLES.master) +
          " WHERE booking_number = @booking AND environment = 'In-Store'" +
          ' ORDER BY media_type, campaign_item_lead_brand, section_order, dimension_primary, dimension_secondary',
          [{name: 'booking', parameterType: {type: 'STRING'}, parameterValue: {value: booking}}]
        );
        const digital = rows.some(function (row) { return row.environment === 'Digital'; })
          ? queryRows_(
            'SELECT booking_number, line_name, brand, media_type, dimension_primary AS promotion_week, ' +
            'total_impressions AS impressions, digital_clicks FROM ' +
            table_(NER_TABLES.master) + " WHERE booking_number = @booking AND environment = 'Digital' " +
            'ORDER BY media_type, line_name, promotion_week, brand',
            [{name: 'booking', parameterType: {type: 'STRING'}, parameterValue: {value: booking}}]
          ) : [];
        const campaign = prepareCampaign_(booking, rows, performance, digital);
        const result = buildCampaignDeck_(campaign, template, properties, ledgerKey);
        summary.created.push(result);
        console.log('NER created: ' + result.url);
      } catch (error) {
        console.error('NER failed ' + booking + ': ' + error.message);
        errors.push(booking + ': ' + error.message);
      }
    }
    console.log(JSON.stringify(summary));
    if (errors.length) throw new Error('NER generation failures:\n' + errors.join('\n'));
    return summary;
  } finally {
    lock.releaseLock();
  }
}

function digitalMetadataSql_() {
  return `
WITH digital_report AS (
  SELECT DISTINCT booking_number, line_name, brand, media_type
  FROM ${table_(NER_TABLES.master)}
  WHERE environment = 'Digital' AND (@booking IS NULL OR booking_number = @booking)
), scoped AS (
  SELECT DISTINCT d.booking_number, d.line_name, d.brand, d.media_type, c.media,
    SAFE_CAST(c.media_start_date AS DATE) AS media_start_date,
    SAFE_CAST(c.media_end_date AS DATE) AS media_end_date,
    CASE WHEN d.media_type = 'Order Confirmation Page' THEN 'Supermarkets'
      WHEN d.media_type IN ('Big W - Department Page Takeover', 'Big W - Homepage', 'Big W - Event')
      THEN 'BIG W' ELSE 'Unknown' END AS retailer
  FROM digital_report d
  LEFT JOIN \`gcp-wow-cart-data-prod-d710.cdm.dim_cartology_campaigns\` c
    ON d.booking_number = c.booking_number
    AND d.media_type = c.media_type AND d.line_name = c.line_name
), bounds AS (
  SELECT booking_number,
    MIN(SAFE_CAST(media_start_date AS DATE)) AS campaign_start_date,
    MAX(SAFE_CAST(media_end_date AS DATE)) AS campaign_end_date,
    COUNTIF(SAFE_CAST(media_start_date AS DATE) IS NULL
      OR SAFE_CAST(media_end_date AS DATE) IS NULL
      OR SAFE_CAST(media_start_date AS DATE) > SAFE_CAST(media_end_date AS DATE)) AS invalid_dates
  FROM \`gcp-wow-cart-data-prod-d710.cdm.dim_cartology_campaigns\`
  WHERE booking_number IN (SELECT DISTINCT booking_number FROM scoped)
  GROUP BY booking_number
), refresh AS (
  SELECT table_id, last_modified_time FROM
    \`${NER_CONFIG.PROJECT_ID}.${NER_CONFIG.DATASET_ID}.__TABLES__\`
)
SELECT s.*, 'Digital' AS environment, CAST(NULL AS STRING) AS campaign_item_lead_brand,
  b.campaign_start_date, b.campaign_end_date, b.invalid_dates,
  fm.last_modified_time AS detail_refreshed_ms, fm.last_modified_time AS final_refreshed_ms,
  cm.last_modified_time AS union_refreshed_ms, mm.last_modified_time AS master_refreshed_ms
FROM scoped s
LEFT JOIN bounds b USING (booking_number)
LEFT JOIN refresh fm ON fm.table_id = CASE WHEN s.retailer = 'BIG W'
  THEN '${NER_TABLES.bigwDigital}' ELSE '${NER_TABLES.supersDigital}' END
LEFT JOIN refresh cm ON cm.table_id = '${NER_TABLES.digitalCombined}'
LEFT JOIN refresh mm ON mm.table_id = '${NER_TABLES.master}'
ORDER BY s.booking_number, s.media_type, s.line_name, s.media_start_date`;
}

function metadataSql_() {
  const source = '`gcp-wow-cart-data-prod-d710.cdm.dim_cartology_campaigns`';
  return `
WITH details AS (
  SELECT DISTINCT booking_number, campaign_item_lead_brand, brand, media_type, media,
    SAFE_CAST(media_start_date AS DATE) AS media_start_date,
    SAFE_CAST(media_end_date AS DATE) AS media_end_date,
    CASE WHEN sales_org = '1030' THEN 'Metro Stores' ELSE 'Supermarkets' END AS retailer,
    '${NER_TABLES.supersDetails}' AS detail_table,
    '${NER_TABLES.supersFinal}' AS final_table
  FROM ${table_(NER_TABLES.supersDetails)}
  WHERE ${inStoreMediaPredicate_('media_type')}
  UNION ALL
  SELECT DISTINCT booking_number, campaign_item_lead_brand, brand, media_type, media,
    SAFE_CAST(media_start_date AS DATE), SAFE_CAST(media_end_date AS DATE),
    'BIG W', '${NER_TABLES.bigwDetails}', '${NER_TABLES.bigwFinal}'
  FROM ${table_(NER_TABLES.bigwDetails)}
  WHERE ${inStoreMediaPredicate_('media_type')}
), scoped AS (
  SELECT d.* FROM details d
  WHERE (@booking IS NULL OR d.booking_number = @booking)
    AND EXISTS (
      SELECT 1 FROM ${table_(NER_TABLES.master)} m
      WHERE m.environment = 'In-Store' AND m.booking_number = d.booking_number
        AND m.media_type = d.media_type
        AND m.brand IS NOT DISTINCT FROM d.campaign_item_lead_brand
    )
), bounds AS (
  SELECT booking_number,
    MIN(SAFE_CAST(media_start_date AS DATE)) AS campaign_start_date,
    MAX(SAFE_CAST(media_end_date AS DATE)) AS campaign_end_date,
    COUNTIF(SAFE_CAST(media_start_date AS DATE) IS NULL
      OR SAFE_CAST(media_end_date AS DATE) IS NULL
      OR SAFE_CAST(media_start_date AS DATE) > SAFE_CAST(media_end_date AS DATE)) AS invalid_dates
  FROM ${source}
  WHERE booking_number IN (SELECT DISTINCT booking_number FROM scoped)
  GROUP BY booking_number
), refresh AS (
  SELECT table_id, last_modified_time FROM
    \`${NER_CONFIG.PROJECT_ID}.${NER_CONFIG.DATASET_ID}.__TABLES__\`
)
SELECT d.*, b.campaign_start_date, b.campaign_end_date, b.invalid_dates,
  dm.last_modified_time AS detail_refreshed_ms,
  fm.last_modified_time AS final_refreshed_ms,
  cm.last_modified_time AS union_refreshed_ms, mm.last_modified_time AS master_refreshed_ms
FROM scoped d
LEFT JOIN bounds b USING (booking_number)
LEFT JOIN refresh dm ON dm.table_id = d.detail_table
LEFT JOIN refresh fm ON fm.table_id = d.final_table
LEFT JOIN refresh cm ON cm.table_id = '${NER_TABLES.combined}'
LEFT JOIN refresh mm ON mm.table_id = '${NER_TABLES.master}'
ORDER BY d.booking_number, d.media_type, d.campaign_item_lead_brand, d.media_start_date`;
}

function readinessReason_(rows, today) {
  for (const row of rows) {
    if (!validDate_(row.media_start_date) || !validDate_(row.media_end_date) ||
        row.media_start_date > row.media_end_date ||
        !validDate_(row.campaign_start_date) || !validDate_(row.campaign_end_date) ||
        row.invalid_dates !== 0) {
      return 'Missing/invalid media dates; campaign completion cannot be confirmed.';
    }
    if (row.campaign_end_date >= today || row.media_end_date >= today) {
      return 'Campaign is still live or has a future media flight (latest end: ' +
        row.campaign_end_date + ').';
    }
    const times = [row.detail_refreshed_ms, row.final_refreshed_ms,
      row.union_refreshed_ms, row.master_refreshed_ms];
    if (times.some(function (value) { return !Number.isSafeInteger(value) || value <= 0; })) {
      return 'Required source/reporting table refresh metadata is missing.';
    }
    if (row.final_refreshed_ms < row.detail_refreshed_ms ||
        row.union_refreshed_ms < row.final_refreshed_ms) {
      return 'Refresh the source performance table and then the combined final table.';
    }
    if (row.master_refreshed_ms < row.union_refreshed_ms) {
      return 'Refresh the master omnichannel table after the combined final tables.';
    }
    const finalDay = Utilities.formatDate(
      new Date(row.final_refreshed_ms), NER_CONFIG.TIME_ZONE, 'yyyy-MM-dd'
    );
    if (finalDay <= row.campaign_end_date) {
      return 'Performance table has not been refreshed after the final campaign day.';
    }
  }
  return null;
}

function prepareCampaign_(booking, metadata, performance, digitalPerformance) {
  const networks = groupBy_(metadata.filter(function (row) {
    return row.environment !== 'Digital';
  }), networkKey_);
  const reportGroups = groupBy_(performance, networkKey_);
  reportGroups.forEach(function (_, key) {
    if (!networks.has(key)) throw new Error('Final table contains an unexpected media/brand group: ' + key);
  });
  const groups = [];
  networks.forEach(function (details, key) {
    const rows = reportGroups.get(key) || [];
    const retailers = distinct_(details.map(function (row) { return row.retailer; }));
    if (retailers.length !== 1) throw new Error('Ambiguous retailer for ' + key);
    const totals = rows.filter(function (row) {
      return row.section_order === 2 && row.dimension_primary === 'TOTAL';
    });
    if (totals.length !== 1) throw new Error('Expected exactly one deduplicated TOTAL row for ' + key);
    const seen = new Set();
    rows.forEach(function (row) {
      if (![1, 2, 3, 4, 5, 6].includes(row.section_order)) {
        throw new Error('Unknown section_order for ' + key);
      }
      const identity = JSON.stringify([row.section_order, row.dimension_primary, row.dimension_secondary]);
      if (seen.has(identity)) throw new Error('Duplicate reporting row for ' + key + ': ' + identity);
      seen.add(identity);
      ['total_impressions', 'edr_impressions', 'edr_reach'].forEach(function (field) {
        if (!Number.isSafeInteger(row[field]) || row[field] < 0) {
          throw new Error('Invalid ' + field + ' for ' + key);
        }
      });
      if (row.edr_frequency !== null &&
          (!Number.isFinite(row.edr_frequency) || row.edr_frequency < 0)) {
        throw new Error('Invalid edr_frequency for ' + key);
      }
      if ([1, 2].includes(row.section_order) &&
          (!Number.isSafeInteger(row.active_store_count) || row.active_store_count < 0)) {
        throw new Error('Invalid active_store_count for ' + key);
      }
    });
    const expectedPeriods = distinct_(details.map(function (row) {
      return row.media_start_date + ' to ' + row.media_end_date;
    })).sort();
    const actualPeriods = rows.filter(function (row) { return row.section_order === 1; })
      .map(function (row) { return row.dimension_primary; }).sort();
    if (JSON.stringify(expectedPeriods) !== JSON.stringify(actualPeriods)) {
      throw new Error('Final table is missing or has stale campaign periods for ' + key);
    }
    NER_SECTIONS.forEach(function (section) {
      if (!rows.some(function (row) { return row.section_order === section.order; })) {
        throw new Error('Missing ' + section.title + ' for ' + key);
      }
    });
    const brands = distinct_(details.map(function (row) {
      return row.campaign_item_lead_brand || row.brand;
    }).filter(Boolean));
    if (!brands.length) throw new Error('No brand supplied for ' + key);
    const mediaType = details[0].media_type;
    if (!mediaType) throw new Error('Missing media_type for booking ' + booking);
    groups.push({
      key: key, mediaType: mediaType, brand: brands.join(' / '),
      retailer: retailers[0], details: details, rows: rows,
      networkLabel: retailers[0] + ' | ' + mediaType
    });
  });
  groups.push.apply(groups, prepareDigitalGroups_(booking, metadata, digitalPerformance || []));
  if (!groups.length) throw new Error('No media groups found for ' + booking);
  groups.sort(function (a, b) { return a.key.localeCompare(b.key); });
  if (distinct_(groups.map(function (group) { return group.brand; })).length > 1) {
    groups.forEach(function (group) { group.networkLabel += ' | ' + group.brand; });
  }
  const brands = distinct_(groups.map(function (group) { return group.brand; })).join(' / ');
  const screens = distinct_(groups.map(function (group) {
    return NER_CONFIG.SCREEN_NAMES[group.mediaType] || group.mediaType;
  })).join(' / ');
  return {
    booking: booking, brand: brands, coverTitle: brands + ' ' + screens,
    start: metadata.map(function (row) { return row.media_start_date; }).sort()[0],
    end: metadata.map(function (row) { return row.media_end_date; }).sort().slice(-1)[0],
    groups: groups, metadata: metadata
  };
}

function prepareDigitalGroups_(booking, metadata, rows) {
  const details = metadata.filter(function (row) { return row.environment === 'Digital'; });
  const groups = groupBy_(details, function (row) {
    return JSON.stringify([row.retailer, row.media_type]);
  });
  const reports = new Map();
  rows.forEach(function (row) {
    const retailer = NER_DIGITAL_TYPES[row.media_type];
    if (!retailer) throw new Error('Unexpected digital media type for ' + booking + ': ' + row.media_type);
    const key = JSON.stringify([retailer, row.media_type]);
    if (!groups.has(key)) throw new Error('Digital result has no matching campaign media: ' + key);
    if (!row.line_name || !row.promotion_week || !row.brand ||
        !Number.isSafeInteger(row.impressions) || row.impressions < 0 ||
        !Number.isSafeInteger(row.digital_clicks) || row.digital_clicks < 0) {
      throw new Error('Digital result has missing or invalid line, brand, period, impressions or clicks: ' + key);
    }
    if (!groups.get(key).some(function (detail) { return detail.line_name === row.line_name; })) {
      throw new Error('Digital result line has no matching campaign media: ' + row.line_name);
    }
    if (!reports.has(key)) reports.set(key, []);
    reports.get(key).push(row);
  });
  const result = [];
  groups.forEach(function (group, key) {
    const groupRows = (reports.get(key) || []).slice();
    group.forEach(function (detail) {
      if (!detail.line_name) {
        throw new Error('Missing digital campaign line name for ' + key);
      }
      if (!groupRows.some(function (row) {
        return row.line_name === detail.line_name;
      })) {
        throw new Error('Master digital result no longer matches discovered line: ' + detail.line_name);
      }
    });
    const brands = distinct_(groupRows.map(function (row) { return row.brand; }).concat(
      group.map(function (detail) { return detail.brand; }).filter(Boolean)
    ));
    result.push({
      key: 'digital-' + key, environment: 'Digital', mediaType: group[0].media_type,
      brand: brands.join(' / ') || 'Brand not supplied', retailer: group[0].retailer,
      details: group, rows: groupRows,
      networkLabel: group[0].retailer + ' | Digital | ' + group[0].media_type
    });
  });
  return result;
}

function buildCampaignDeck_(campaign, template, properties, ledgerKey) {
  const deck = SlidesApp.create('[BUILDING] ' + campaign.booking + ' PCR');
  const id = deck.getId();
  const marker = 'NER_PCR_GENERATED:' + campaign.booking;
  properties.setProperty(ledgerKey, JSON.stringify({
    status: 'building', id: id, booking: campaign.booking
  }));
  updateFile_(id, {description: marker});
  moveToOutputFolder_(id);
  assertPageSize_(deck);
  const initialSlide = deck.getSlides()[0];
  const prototypes = template.getSlides();
  const drawingRequests = [];
  appendPrototype_(deck, prototypes[0], {
    COVER_TITLE: campaign.coverTitle,
    LIVE_DATES: displayDate_(campaign.start) + ' - ' + displayDate_(campaign.end)
  });
  const schedule = scheduleRows_(campaign);
  const scheduleColumns = [
    ['Banner', 0.09], ['Channel', 0.08], ['Ad Format', 0.10], ['Start Date', 0.09],
    ['End Date', 0.09], ['Booking Type', 0.09], ['Lead Brand', 0.09],
    ['Material Deadline', 0.10], ['Quantity', 0.08], ['Sales Price', 0.10],
    ['Gross Media Cost', 0.09]
  ];
  const schedulePages = paginateTable_(scheduleColumns, schedule, 620, 280, 6.4, 30);
  schedulePages.forEach(function (page, index) {
    const slide = appendPrototype_(deck, prototypes[1], {
      CONTINUED: 'Booking ' + campaign.booking +
        (schedulePages.length > 1 ? ' | Schedule ' + (index + 1) + '/' + schedulePages.length : '')
    });
    queueTable_(drawingRequests, slide.getObjectId(), scheduleColumns, page,
      55, 78, 620, 6.4, 30, true);
  });
  campaign.groups.forEach(function (group) {
    if (group.environment === 'Digital') return;
    appendPrototype_(deck, prototypes[2], {NETWORK: group.networkLabel});
    NER_SECTIONS.forEach(function (section, sectionIndex) {
      const table = performanceTable_(group, section.order);
      const layout = performanceLayout_(table, section.order);
      const pages = layout.pages;
      pages.forEach(function (page, pageIndex) {
        const slide = appendPrototype_(deck, prototypes[sectionIndex + 3], {
          NETWORK: group.networkLabel +
            (pages.length > 1 ? ' | ' + (pageIndex + 1) + '/' + pages.length : '')
        });
        queueTable_(drawingRequests, slide.getObjectId(), table.columns, page,
          120, layout.top, 480, layout.fontSize, layout.minimumRowHeight, false);
        if (!page.length) {
          queueCell_(drawingRequests, slide.getObjectId(), 'No mapped results available',
            120, layout.top + 33, 480, 25, 9, NER_DARK, false, null);
        }
      });
    });
  });
  const digitalGroups = campaign.groups.filter(function (group) {
    return group.environment === 'Digital';
  });
  if (digitalGroups.length) {
    appendPrototype_(deck, prototypes[2], {NETWORK: 'Digital'});
    const table = digitalPerformanceTable_(digitalGroups);
    const layout = digitalLayout_(table);
    layout.pages.forEach(function (page, index) {
      const slide = appendPrototype_(deck, prototypes[3], {
        NETWORK: 'Digital' + (layout.pages.length > 1 ? ' | ' + (index + 1) + '/' + layout.pages.length : '')
      });
      slide.replaceAllText('Media Results | Overall Performance by Period',
        'Media Results | Digital Performance by Period');
      queueTable_(drawingRequests, slide.getObjectId(), table.columns, page,
        55, layout.top, 620, layout.fontSize, layout.minimumRowHeight, false);
    });
  }
  initialSlide.remove();
  deck.getSlides().forEach(function (slide, index) {
    slide.replaceAllText('{{PAGE_NUMBER}}', String(index + 1));
    slide.getShapes().forEach(function (shape) {
      if (/\{\{[^}]+\}\}/.test(shape.getText().asString())) {
        throw new Error('Unresolved placeholder on slide ' + (index + 1));
      }
    });
  });
  const slideCount = deck.getSlides().length;
  deck.saveAndClose();
  for (let offset = 0; offset < drawingRequests.length; offset += 400) {
    Slides.Presentations.batchUpdate({requests: drawingRequests.slice(offset, offset + 400)}, id);
  }
  const name = campaign.booking + ' - ' + campaign.brand + ' - Media Reporting PCR';
  updateFile_(id, {name: name});
  const result = {
    booking: campaign.booking, id: id,
    url: 'https://docs.google.com/presentation/d/' + id + '/edit',
    slideCount: slideCount, mediaGroups: campaign.groups.length,
    completedAt: new Date().toISOString()
  };
  properties.setProperty(ledgerKey, JSON.stringify(Object.assign({status: 'complete'}, result)));
  return result;
}

function digitalPerformanceTable_(groups) {
  const rows = [];
  groups.forEach(function (group) {
    group.rows.forEach(function (row) {
        const ctr = row.impressions === 0 ? 'N/A' :
          (row.digital_clicks / row.impressions * 100).toFixed(2) + '%';
        rows.push({values: [row.promotion_week, row.line_name, group.mediaType,
          formatNumber_(row.impressions), formatNumber_(row.digital_clicks), ctr], bold: false});
    });
  });
  return {
    columns: [['Campaign Period', 0.23], ['Line Name', 0.14], ['Media Type', 0.22],
      ['Total Impressions', 0.15], ['Digital Clicks', 0.12],
      ['CTR (Digital Clicks / Impressions)', 0.14]],
    rows: rows
  };
}

function digitalLayout_(table) {
  const normal = {
    top: 103, fontSize: 7.4, minimumRowHeight: 20,
    pages: paginateTable_(table.columns, table.rows, 620, 262, 7.4, 20)
  };
  if (normal.pages.length === 1) return normal;
  let compact;
  for (const fontSize of [7.4, 7, 6.5, 6, 5.5]) {
    compact = {
      top: 98, fontSize: fontSize, minimumRowHeight: 16,
      pages: paginateTable_(table.columns, table.rows, 620, 276, fontSize, 16)
    };
    if (compact.pages.length === 1) return compact;
  }
  return compact;
}

function performanceTable_(group, order) {
  const first = {
    1: ['Campaign Period', 0.26],
    3: ['Lifestage Segments', 0.40],
    4: ['Price Segments', 0.40],
    5: ['Geographical State', 0.16],
    6: ['Geographical State', 0.22]
  };
  let columns;
  if (order === 1) {
    columns = [first[order], ['Store Count', 0.09],
      [group.retailer === 'BIG W' ? 'Total Impressions' : 'Unique Baskets', 0.17],
      ['EDR Impressions', 0.18], ['EDR Reach', 0.16], ['EDR Frequency', 0.14]];
  } else if (order === 3 || order === 4) {
    columns = [first[order], ['EDR Impressions', 0.23], ['EDR Reach', 0.20], ['EDR Frequency', 0.17]];
  } else if (order === 5) {
    columns = [first[order], ['Metro/Regional Flag', 0.18], ['Total Impressions', 0.19],
      ['EDR Impressions', 0.19], ['EDR Reach', 0.16], ['EDR Frequency', 0.12]];
  } else {
    columns = [first[order], ['Total Impressions', 0.22], ['EDR Impressions', 0.23],
      ['EDR Reach', 0.19], ['EDR Frequency', 0.14]];
  }
  const rows = group.rows.filter(function (row) {
    return row.section_order === order || (order === 1 && row.section_order === 2);
  }).filter(function (row) {
    if (order === 1) return true;
    return mappedDimension_(row.dimension_primary) &&
      (order !== 5 || mappedDimension_(row.dimension_secondary));
  }).sort(function (a, b) {
    return a.section_order - b.section_order ||
      String(a.dimension_primary || '').localeCompare(String(b.dimension_primary || '')) ||
      String(a.dimension_secondary || '').localeCompare(String(b.dimension_secondary || ''));
  }).map(function (row) {
    const values = [row.dimension_primary];
    if (order === 1) values.push(formatNumber_(row.active_store_count));
    if (order === 5) values.push(row.dimension_secondary);
    if (![3, 4].includes(order)) values.push(formatNumber_(row.total_impressions));
    values.push(formatNumber_(row.edr_impressions), formatNumber_(row.edr_reach),
      row.edr_frequency === null ? 'N/A' : row.edr_frequency.toFixed(2));
    return {values: values, bold: row.section_order === 2};
  });
  return {columns: columns, rows: rows};
}

function mappedDimension_(value) {
  return value !== null && value !== undefined &&
    String(value).trim() !== '' && String(value).trim().toLowerCase() !== 'unmapped';
}

function performanceLayout_(table, order) {
  const normal = {
    top: 103, fontSize: 7.4, minimumRowHeight: 20,
    pages: table.rows.length
      ? paginateTable_(table.columns, table.rows, 480, 262, 7.4, 20)
      : [[]]
  };
  if (order !== 5 || normal.pages.length === 1) return normal;
  let compact;
  for (const fontSize of [7.4, 7, 6.5, 6, 5.5]) {
    compact = {
      top: 98, fontSize: fontSize, minimumRowHeight: 16,
      pages: paginateTable_(table.columns, table.rows, 480, 276, fontSize, 16)
    };
    if (compact.pages.length === 1) return compact;
  }
  return compact;
}

function scheduleRows_(campaign) {
  const unique = new Map();
  campaign.metadata.forEach(function (row) {
    let brand = row.campaign_item_lead_brand || row.brand;
    if (row.environment === 'Digital') {
      const group = campaign.groups.find(function (item) {
        return item.environment === 'Digital' && item.mediaType === row.media_type &&
          item.retailer === row.retailer;
      });
      if (!group) throw new Error('Missing digital group for schedule: ' + row.media_type);
      brand = distinct_(group.rows.filter(function (item) {
        return item.line_name === row.line_name;
      }).map(function (item) { return item.brand; })).join(' / ');
      if (!brand) throw new Error('Missing digital brand for schedule: ' + row.line_name);
    }
    const values = [
      row.retailer === 'Supermarkets' ? 'Supers' : row.retailer,
      row.environment === 'Digital' ? 'Digital' : 'Instore', row.media_type,
      displayDate_(row.media_start_date), displayDate_(row.media_end_date),
      'Not supplied', brand,
      'Not supplied', 'Not supplied', 'Not supplied', 'Not supplied'
    ];
    unique.set(JSON.stringify(values), {
      values: values, start: row.media_start_date, retailer: row.retailer, bold: false
    });
  });
  return Array.from(unique.values()).sort(function (a, b) {
    return a.start.localeCompare(b.start) || a.retailer.localeCompare(b.retailer);
  });
}

function paginateTable_(columns, rows, width, bodyHeight, fontSize, minimumRowHeight) {
  const pages = [];
  let page = [];
  let height = 0;
  rows.forEach(function (row) {
    const cells = row.values.map(function (value, index) {
      return wrapText_(String(value), width * columns[index][1] - 8, fontSize);
    });
    const rowHeight = Math.max(minimumRowHeight,
      Math.max.apply(null, cells.map(function (cell) { return cell.split('\n').length; })) *
        fontSize * 1.3 + 9);
    if (rowHeight > bodyHeight - 33) throw new Error('A table row is too tall to fit a slide.');
    if (height + rowHeight > bodyHeight - 33 && page.length) {
      pages.push(page);
      page = [];
      height = 0;
    }
    page.push({values: cells, bold: row.bold, height: rowHeight});
    height += rowHeight;
  });
  if (page.length) pages.push(page);
  if (!pages.length) throw new Error('Cannot render an empty reporting table.');
  return pages;
}

function queueTable_(requests, slideId, columns, rows, x, y, width, fontSize, minimumRowHeight, striped) {
  let offset = x;
  columns.forEach(function (column) {
    const cellWidth = width * column[1];
    queueCell_(requests, slideId, wrapText_(column[0], cellWidth - 8, fontSize),
      offset, y, cellWidth, 33, fontSize, '#FFFFFF', true, NER_GREEN);
    offset += cellWidth;
  });
  let top = y + 33;
  rows.forEach(function (row, rowIndex) {
    const height = Math.max(minimumRowHeight, row.height);
    const background = striped ? (rowIndex % 2 ? '#D9D9D9' : '#F2F2F2') : null;
    let left = x;
    row.values.forEach(function (value, columnIndex) {
      const cellWidth = width * columns[columnIndex][1];
      queueCell_(requests, slideId, value, left, top, cellWidth, height,
        fontSize, '#252525', row.bold, background);
      left += cellWidth;
    });
    top += height;
  });
}

function queueCell_(requests, slideId, text, x, y, width, height, fontSize, color, bold, background) {
  const id = 'ner_data_' + requests.length;
  requests.push({
    createShape: {
      objectId: id, shapeType: 'TEXT_BOX',
      elementProperties: {
        pageObjectId: slideId,
        size: {width: {magnitude: width, unit: 'PT'}, height: {magnitude: height, unit: 'PT'}},
        transform: {scaleX: 1, scaleY: 1, translateX: x, translateY: y, unit: 'PT'}
      }
    }
  });
  if (text) requests.push({insertText: {objectId: id, text: text, insertionIndex: 0}});
  requests.push({
    updateTextStyle: {
      objectId: id, textRange: {type: 'ALL'},
      style: {
        fontFamily: 'Montserrat', fontSize: {magnitude: fontSize, unit: 'PT'},
        foregroundColor: {opaqueColor: {rgbColor: rgbColor_(color)}}, bold: Boolean(bold)
      },
      fields: 'fontFamily,fontSize,foregroundColor,bold'
    }
  });
  requests.push({
    updateParagraphStyle: {
      objectId: id, textRange: {type: 'ALL'},
      style: {spaceAbove: {magnitude: 0, unit: 'PT'}, spaceBelow: {magnitude: 0, unit: 'PT'}},
      fields: 'spaceAbove,spaceBelow'
    }
  });
  requests.push({
    updateShapeProperties: {
      objectId: id,
      shapeProperties: {
        contentAlignment: 'MIDDLE',
        outline: {propertyState: 'NOT_RENDERED'},
        shapeBackgroundFill: background
          ? {solidFill: {color: {rgbColor: rgbColor_(background)}, alpha: 1}}
          : {propertyState: 'NOT_RENDERED'}
      },
      fields: 'contentAlignment,outline,shapeBackgroundFill'
    }
  });
}

function rgbColor_(hex) {
  return {
    red: parseInt(hex.slice(1, 3), 16) / 255,
    green: parseInt(hex.slice(3, 5), 16) / 255,
    blue: parseInt(hex.slice(5, 7), 16) / 255
  };
}

function textBox_(slide, text, x, y, width, height, fontSize, color, bold, title) {
  const shape = slide.insertTextBox(text, x, y, width, height);
  shape.getText().getTextStyle().setFontFamily('Montserrat')
    .setFontSize(fontSize).setForegroundColor(color).setBold(Boolean(bold));
  shape.getText().getParagraphStyle().setSpaceAbove(0).setSpaceBelow(0);
  shape.setContentAlignment(SlidesApp.ContentAlignment.MIDDLE);
  if (title) shape.setTitle(title);
  return shape;
}

function appendPrototype_(deck, prototype, values) {
  const slide = deck.appendSlide(prototype);
  Object.keys(values).forEach(function (key) {
    slide.replaceAllText('{{' + key + '}}', String(values[key]));
  });
  slide.getShapes().forEach(function (shape) {
    if (['COVER_TITLE', 'LIVE_DATES', 'NETWORK'].includes(shape.getTitle())) {
      const style = shape.getText().getTextStyle();
      const text = shape.getText().asString().replace(/\n$/, '');
      const fitted = fitText_(text, shape.getWidth(), shape.getHeight(), style.getFontSize(), 7);
      shape.getText().setText(fitted.text);
      shape.getText().getTextStyle().setFontSize(fitted.size);
    }
  });
  return slide;
}

function wrapText_(text, width, fontSize) {
  const maxCharacters = Math.max(1, Math.floor(width / (fontSize * 0.62)));
  return String(text).split('\n').map(function (paragraph) {
    const lines = [];
    let line = '';
    paragraph.split(/\s+/).filter(Boolean).forEach(function (word) {
      if (line && line.length + word.length + 1 > maxCharacters) {
        lines.push(line);
        line = '';
      }
      while (word.length > maxCharacters) {
        lines.push(word.slice(0, maxCharacters));
        word = word.slice(maxCharacters);
      }
      if (word) line = line ? line + ' ' + word : word;
    });
    if (line || !lines.length) lines.push(line);
    return lines.join('\n');
  }).join('\n');
}

function fitText_(text, width, height, maximum, minimum) {
  for (let size = maximum; size >= minimum; size -= 0.5) {
    const wrapped = wrapText_(text, width - 8, size);
    if (wrapped.split('\n').length * size * 1.3 + 8 <= height) {
      return {text: wrapped, size: size};
    }
  }
  throw new Error('Text is too long for its template box: ' + text);
}

function addFooter_(slide, blob) {
  slide.insertImage(blob, 0, 374, 720, 18);
  textBox_(slide, '{{PAGE_NUMBER}}', 683, 374, 18, 18, 7, '#FFFFFF');
}

function markRole_(slide, role) {
  slide.getNotesPage().getSpeakerNotesShape().getText().setText('NER_TEMPLATE_ROLE=' + role);
}

function validateTemplate_(deck) {
  assertPageSize_(deck);
  const roles = ['cover', 'schedule', 'divider'].concat(NER_SECTIONS.map(function (section) {
    return 'section-' + section.order;
  }));
  const slides = deck.getSlides();
  if (slides.length !== roles.length) throw new Error('NER template must contain exactly eight prototype slides.');
  slides.forEach(function (slide, index) {
    if (slide.getNotesPage().getSpeakerNotesShape().getText().asString().trim() !==
        'NER_TEMPLATE_ROLE=' + roles[index]) {
      throw new Error('Template slide order/role changed at slide ' + (index + 1));
    }
  });
}

function assertPageSize_(deck) {
  if (Math.abs(deck.getPageWidth() - 720) > 0.1 || Math.abs(deck.getPageHeight() - 405) > 0.1) {
    throw new Error('NER requires a widescreen 720 x 405 point presentation.');
  }
}

function recoverInterruptedDeck_(record, booking, properties, ledgerKey) {
  if (record.status !== 'building' || record.booking !== booking || !record.id) {
    throw new Error('Invalid generation ledger for ' + booking + '; review Script properties.');
  }
  const file = Drive.Files.get(record.id, {fields: 'description', supportsAllDrives: true});
  if (file.description !== 'NER_PCR_GENERATED:' + booking) {
    throw new Error('Interrupted deck ownership cannot be verified; refusing to remove it.');
  }
  updateFile_(record.id, {trashed: true});
  properties.deleteProperty(ledgerKey);
  console.warn('Removed interrupted generated deck for retry: ' + booking);
}

function queryRows_(sql, parameters, optionalBooking) {
  const location = BigQuery.Datasets.get(NER_CONFIG.PROJECT_ID, NER_CONFIG.DATASET_ID).location;
  if (!location) throw new Error('BigQuery dataset location is unavailable.');
  const params = parameters.slice();
  if (optionalBooking === null) {
    params.push({name: 'booking', parameterType: {type: 'STRING'}, parameterValue: {value: null}});
  }
  const request = {
    query: sql, useLegacySql: false, location: location, timeoutMs: 10000,
    maxResults: 1000, maximumBytesBilled: NER_CONFIG.MAXIMUM_BYTES_BILLED
  };
  if (params.length) {
    request.parameterMode = 'NAMED';
    request.queryParameters = params;
  }
  let response = BigQuery.Jobs.query(request, NER_CONFIG.PROJECT_ID);
  const job = response.jobReference;
  if (!job || !job.jobId) throw new Error('BigQuery did not return a job reference.');
  const deadline = Date.now() + 45000;
  while (!response.jobComplete) {
    assertQuerySuccess_(response);
    if (Date.now() > deadline) {
      BigQuery.Jobs.cancel(NER_CONFIG.PROJECT_ID, job.jobId, {location: job.location || location});
      throw new Error('BigQuery query exceeded the 45 second polling limit; job cancelled.');
    }
    Utilities.sleep(500);
    response = BigQuery.Jobs.getQueryResults(NER_CONFIG.PROJECT_ID, job.jobId, {
      location: job.location || location, timeoutMs: 1000, maxResults: 1000
    });
  }
  assertQuerySuccess_(response);
  if (!response.schema || !response.schema.fields) throw new Error('BigQuery response has no schema.');
  const fields = response.schema.fields;
  let results = decodeRows_(fields, response.rows || []);
  while (response.pageToken) {
    response = BigQuery.Jobs.getQueryResults(NER_CONFIG.PROJECT_ID, job.jobId, {
      location: job.location || location, pageToken: response.pageToken, maxResults: 1000
    });
    assertQuerySuccess_(response);
    results = results.concat(decodeRows_(fields, response.rows || []));
  }
  return results;
}

function assertQuerySuccess_(response) {
  if (response.errors && response.errors.length) {
    throw new Error('BigQuery: ' + response.errors.map(function (error) {
      return error.message || error.reason;
    }).join('; '));
  }
}

function decodeRows_(fields, rows) {
  return rows.map(function (row) {
    const result = {};
    fields.forEach(function (field, index) {
      const value = row.f[index].v;
      if (value === null) {
        result[field.name] = null;
      } else if (['INTEGER', 'INT64', 'FLOAT', 'FLOAT64', 'NUMERIC', 'BIGNUMERIC'].includes(field.type)) {
        const number = Number(value);
        if (!Number.isFinite(number) ||
            (['INTEGER', 'INT64'].includes(field.type) && !Number.isSafeInteger(number))) {
          throw new Error('Unsafe or invalid numeric value in ' + field.name);
        }
        result[field.name] = number;
      } else {
        result[field.name] = value;
      }
    });
    return result;
  });
}

function validateConfig_() {
  if (!NER_CONFIG.OUTPUT_FOLDER_ID.trim()) {
    throw new Error('Set NER_CONFIG.OUTPUT_FOLDER_ID to the Google Drive output folder ID.');
  }
  if (!/^[A-Za-z0-9_-]+$/.test(NER_CONFIG.OUTPUT_FOLDER_ID) ||
      (NER_CONFIG.ARTWORK_FOLDER_ID && !/^[A-Za-z0-9_-]+$/.test(NER_CONFIG.ARTWORK_FOLDER_ID))) {
    throw new Error('Use Google Drive folder IDs only, not URLs or Windows paths.');
  }
  if (!/^[a-z0-9-]+$/.test(NER_CONFIG.PROJECT_ID) ||
      !/^[A-Za-z0-9_]+$/.test(NER_CONFIG.DATASET_ID)) {
    throw new Error('Invalid BigQuery project/dataset identifier.');
  }
  if (!Number.isInteger(NER_CONFIG.MAX_CAMPAIGNS_PER_RUN) || NER_CONFIG.MAX_CAMPAIGNS_PER_RUN < 1) {
    throw new Error('MAX_CAMPAIGNS_PER_RUN must be a positive integer.');
  }
}

function uniqueFile_(folder, name) {
  const result = Drive.Files.list({
    q: "'" + folder + "' in parents and name = '" + name + "' and trashed = false",
    fields: 'files(id),nextPageToken', pageSize: 2,
    supportsAllDrives: true, includeItemsFromAllDrives: true
  });
  const files = result.files || [];
  if (!files.length) throw new Error('Upload ' + name + ' to the configured artwork folder.');
  if (files.length > 1 || result.nextPageToken) {
    throw new Error('More than one artwork file named ' + name + '; remove the ambiguity.');
  }
  return DriveApp.getFileById(files[0].id);
}

function updateFile_(id, metadata) {
  return Drive.Files.update(metadata, id, null, {supportsAllDrives: true, fields: 'id'});
}

function moveToOutputFolder_(id) {
  const file = Drive.Files.get(id, {fields: 'parents', supportsAllDrives: true});
  const options = {
    addParents: NER_CONFIG.OUTPUT_FOLDER_ID, supportsAllDrives: true, fields: 'id'
  };
  if (file.parents && file.parents.length) options.removeParents = file.parents.join(',');
  Drive.Files.update({}, id, null, options);
}

function table_(name) {
  return '`' + NER_CONFIG.PROJECT_ID + '.' + NER_CONFIG.DATASET_ID + '.' + name + '`';
}

function inStoreMediaPredicate_(column) {
  const excluded = Object.keys(NER_DIGITAL_TYPES).map(function (name) {
    return "'" + name.replace(/'/g, "''") + "'";
  }).join(', ');
  return '(' + column + ' IS NULL OR ' + column + ' NOT IN (' + excluded + '))';
}

function networkKey_(row) {
  return JSON.stringify([row.media_type, row.campaign_item_lead_brand]);
}

function groupBy_(rows, keyFunction) {
  const groups = new Map();
  rows.forEach(function (row) {
    const key = keyFunction(row);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(row);
  });
  return groups;
}

function distinct_(values) {
  return Array.from(new Set(values));
}

function ledgerKey_(booking) {
  return 'NER_CAMPAIGN_' + encodeURIComponent(booking);
}

function validDate_(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(value + 'T00:00:00Z');
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function displayDate_(value) {
  if (!validDate_(value)) throw new Error('Invalid media date: ' + value);
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return Number(value.slice(8, 10)) + ' ' + months[Number(value.slice(5, 7)) - 1] + ' ' + value.slice(0, 4);
}

function formatNumber_(value) {
  if (!Number.isSafeInteger(value) || value < 0) throw new Error('Invalid count: ' + value);
  return String(value).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}
