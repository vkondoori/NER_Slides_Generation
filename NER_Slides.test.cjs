const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const {test} = require('node:test');

const source = fs.readFileSync(path.join(__dirname, 'NER_Slides.gs'), 'utf8');

class Shape {
  constructor(text, x = 0, y = 0, width = 100, height = 20) {
    Object.assign(this, {text, x, y, width, height, size: 12, title: ''});
  }
  getText() {
    const shape = this;
    const style = {
      setFontFamily() { return this; },
      setFontSize(value) { shape.size = value; return this; },
      getFontSize() { return shape.size; },
      setForegroundColor() { return this; },
      setBold() { return this; }
    };
    const paragraph = {
      setSpaceAbove() { return this; },
      setSpaceBelow() { return this; }
    };
    return {
      asString: () => shape.text + '\n',
      setText(value) { shape.text = value; return this; },
      getTextStyle: () => style,
      getParagraphStyle: () => paragraph
    };
  }
  getFill() { return {setSolidFill() {}}; }
  getBorder() { return {setTransparent() {}}; }
  setContentAlignment() {}
  setTitle(value) { this.title = value; }
  getTitle() { return this.title; }
  getWidth() { return this.width; }
  getHeight() { return this.height; }
}

class Slide {
  constructor(owner) {
    this.owner = owner;
    this.shapes = [];
    this.notes = new Shape('');
    this.id = 'slide-' + (++owner.slideSerial);
  }
  insertImage() {}
  insertTextBox(...args) {
    const shape = new Shape(...args);
    this.shapes.push(shape);
    return shape;
  }
  insertShape(type, x, y, width, height) {
    return this.insertTextBox('', x, y, width, height);
  }
  getShapes() { return this.shapes; }
  getObjectId() { return this.id; }
  getNotesPage() { return {getSpeakerNotesShape: () => this.notes}; }
  replaceAllText(token, replacement) {
    this.shapes.forEach(shape => { shape.text = shape.text.split(token).join(replacement); });
  }
  remove() { this.owner.slides.splice(this.owner.slides.indexOf(this), 1); }
  copy(owner) {
    const copy = new Slide(owner);
    copy.shapes = this.shapes.map(shape => Object.assign(new Shape(''), shape));
    copy.notes.text = this.notes.text;
    return copy;
  }
}

function harness() {
  const properties = new Map();
  const decks = new Map();
  const files = new Map();
  const requests = [];
  const logs = [];
  const triggers = [];
  let serial = 0;
  const state = {properties, decks, files, requests, logs, triggers, batches: [], failRename: false};
  const scriptProperties = {
    getProperty: key => properties.get(key) || null,
    setProperty(key, value) { properties.set(key, value); },
    deleteProperty(key) { properties.delete(key); }
  };
  const context = vm.createContext({
    console: Object.fromEntries(['log', 'warn', 'error'].map(method =>
      [method, (...args) => logs.push([method, ...args])])),
    PropertiesService: {getScriptProperties: () => scriptProperties},
    LockService: {getScriptLock: () => ({tryLock: () => true, releaseLock() {}})},
    Utilities: {
      sleep() {},
      formatDate(date, timeZone) {
        const parts = new Intl.DateTimeFormat('en-CA', {
          timeZone, year: 'numeric', month: '2-digit', day: '2-digit'
        }).formatToParts(date);
        const part = name => parts.find(item => item.type === name).value;
        return `${part('year')}-${part('month')}-${part('day')}`;
      }
    },
    SlidesApp: {
      PredefinedLayout: {BLANK: 'BLANK'},
      ShapeType: {RECTANGLE: 'RECTANGLE'},
      ContentAlignment: {MIDDLE: 'MIDDLE'},
      openById(id) {
        if (!decks.has(id)) throw new Error('Deck not found');
        return decks.get(id);
      },
      create(name) {
        const id = 'deck-' + (++serial);
        const deck = {
          slides: [], slideSerial: 0,
          getId: () => id,
          getPageWidth: () => 720,
          getPageHeight: () => 405,
          getSlides() { return this.slides; },
          appendSlide(prototype) {
            const slide = prototype instanceof Slide ? prototype.copy(this) : new Slide(this);
            this.slides.push(slide);
            return slide;
          },
          saveAndClose() { this.saved = true; }
        };
        deck.appendSlide('BLANK');
        decks.set(id, deck);
        files.set(id, {id, name, parents: ['my-drive'], description: '', trashed: false});
        return deck;
      }
    },
    Slides: {Presentations: {
      batchUpdate(body, id) {
        state.batches.push(body.requests);
        const deck = decks.get(id);
        const shapes = new Map(deck.slides.flatMap(slide =>
          slide.shapes.filter(shape => shape.objectId).map(shape => [shape.objectId, shape])));
        for (const request of body.requests) {
          if (request.createShape) {
            const create = request.createShape;
            const element = create.elementProperties;
            const slide = deck.slides.find(item => item.id === element.pageObjectId);
            assert.ok(slide, 'Batch drawing must target an existing slide');
            assert.ok(!shapes.has(create.objectId), 'Drawing object IDs must be unique');
            const shape = slide.insertTextBox('', element.transform.translateX,
              element.transform.translateY, element.size.width.magnitude, element.size.height.magnitude);
            shape.objectId = create.objectId;
            shapes.set(create.objectId, shape);
          }
          if (request.insertText) {
            assert.ok(shapes.has(request.insertText.objectId));
            shapes.get(request.insertText.objectId).text = request.insertText.text;
          }
          if (request.updateTextStyle) {
            assert.ok(shapes.has(request.updateTextStyle.objectId));
            shapes.get(request.updateTextStyle.objectId).size =
              request.updateTextStyle.style.fontSize.magnitude;
          }
        }
      }
    }},
    DriveApp: {getFileById: id => ({getBlob: () => ({id})})},
    Drive: {Files: {
      list: () => ({files: [{id: 'asset'}]}),
      get: id => files.get(id),
      update(metadata, id, blob, options) {
        assert.equal(options.supportsAllDrives, true);
        const file = files.get(id);
        if (state.failRename && metadata.name) {
          state.failRename = false;
          throw new Error('Simulated Drive rename failure');
        }
        Object.assign(file, metadata);
        if (options.addParents) file.parents = [options.addParents];
        return {id};
      }
    }},
    BigQuery: {
      Datasets: {get: () => ({location: 'australia-southeast1'})},
      Jobs: {
        query(request) {
          requests.push(request);
          let rows;
          if (request.query.startsWith('\nWITH digital_report AS')) {
            rows = state.digitalMetadata || [];
          } else if (request.query.startsWith('\nWITH')) {
            rows = state.metadata;
          } else if (request.query.includes("environment = 'Digital'")) {
            rows = state.digitalPerformance || [];
          } else {
            rows = state.performance;
          }
          return Object.assign({
            jobComplete: true, jobReference: {jobId: 'job', location: request.location}
          }, bigQueryRows(rows));
        },
        getQueryResults() { throw new Error('Unexpected poll'); },
        cancel() {}
      }
    },
    ScriptApp: {
      getProjectTriggers: () => triggers,
      newTrigger(handler) {
        return {
          timeBased() { return this; },
          atHour() { return this; },
          everyDays() { return this; },
          inTimezone() { return this; },
          create() { triggers.push({getHandlerFunction: () => handler}); }
        };
      }
    }
  });
  vm.runInContext(source, context);
  vm.runInContext("NER_CONFIG.OUTPUT_FOLDER_ID = 'output-folder';", context);
  state.context = context;
  return state;
}

function bigQueryRows(rows) {
  const first = rows[0] || {booking_number: ''};
  const fields = Object.keys(first).map(name => ({
    name,
    type: name === 'edr_frequency' ? 'FLOAT' : typeof first[name] === 'number' ? 'INTEGER' : 'STRING'
  }));
  return {
    schema: {fields},
    rows: rows.map(row => ({f: fields.map(field => ({
      v: row[field.name] === null ? null : String(row[field.name])
    }))}))
  };
}

function fixture() {
  const metadata = [];
  const performance = [];
  const booking = 'WOW-TEST';
  for (const [media, retailer] of [
    ['Digital Screens Supers', 'Supermarkets'],
    ['Metro Digital Screens', 'Metro Stores']
  ]) {
    const base = {booking_number: booking, campaign_item_lead_brand: 'AMEX', media_type: media};
    for (const [start, end] of [['2025-11-05', '2025-11-11'], ['2025-12-03', '2025-12-09']]) {
      metadata.push({
        ...base, brand: 'Amex', media: 'FOS Screens', retailer,
        media_start_date: start, media_end_date: end,
        campaign_start_date: '2025-10-29', campaign_end_date: '2025-12-09', invalid_dates: 0,
        detail_refreshed_ms: Date.parse('2025-12-10T01:00:00Z'),
        final_refreshed_ms: Date.parse('2025-12-10T02:00:00Z'),
        union_refreshed_ms: Date.parse('2025-12-10T03:00:00Z'),
        master_refreshed_ms: Date.parse('2025-12-10T04:00:00Z')
      });
      performance.push({
        ...base, report_section: '1. Performance by Period', section_order: 1,
        dimension_primary: `${start} to ${end}`, dimension_secondary: null,
        active_store_count: 90, total_impressions: 100, edr_impressions: 80,
        edr_reach: 50, edr_frequency: 1.6
      });
    }
    const total = {
      ...base, report_section: '1. Performance by Period', section_order: 2,
      dimension_primary: 'TOTAL', dimension_secondary: null,
      active_store_count: 92, total_impressions: 160, edr_impressions: 140,
      edr_reach: 80, edr_frequency: 1.75
    };
    performance.push(total);
    for (const [order, count] of [[3, 7], [4, 3], [5, 11], [6, 7]]) {
      for (let i = 0; i < count; i++) {
        performance.push({
          ...total, section_order: order, dimension_primary: 'Segment ' + i,
          dimension_secondary: order === 5 ? (i % 2 ? 'Regional' : 'Metro') : null
        });
      }
    }
  }
  return {booking, metadata, performance};
}

function digitalFixture() {
  const data = fixture();
  const metadata = {
    ...data.metadata[0], environment: 'Digital', retailer: 'BIG W', media_type: 'Big W - Homepage',
    brand: 'Brand', campaign_item_lead_brand: null, line_name: 'Homepage A', media: 'Homepage',
    media_start_date: '2025-11-05', media_end_date: '2025-12-09'
  };
  const row = {
    booking_number: data.booking, media_type: metadata.media_type, line_name: metadata.line_name,
    brand: 'Brand', promotion_week: '2025-11-01 to 2025-11-30',
    impressions: 1200, digital_clicks: 23
  };
  return {metadata, row};
}

test('finished means strictly after the last campaign media end date in Sydney', () => {
  const {context} = harness();
  const {metadata} = fixture();
  assert.match(context.readinessReason_(metadata, '2025-12-09'), /still live/);
  assert.equal(context.readinessReason_(metadata, '2025-12-10'), null);
  metadata[0].campaign_end_date = '2026-01-20';
  assert.match(context.readinessReason_(metadata, '2025-12-10'), /future media flight/);
});

test('missing dates, reversed dates and incomplete reporting refreshes defer generation', () => {
  const {context} = harness();
  const {metadata} = fixture();
  metadata[0].media_end_date = null;
  assert.match(context.readinessReason_(metadata, '2025-12-10'), /invalid media dates/);
  metadata[0].media_end_date = '2025-01-01';
  assert.match(context.readinessReason_(metadata, '2025-12-10'), /invalid media dates/);
  metadata[0].media_end_date = '2025-11-11';
  metadata[0].union_refreshed_ms = 1;
  assert.match(context.readinessReason_(metadata, '2025-12-10'), /combined final table/);
  metadata.forEach(row => {
    row.detail_refreshed_ms = Date.parse('2025-12-09T01:00:00Z');
    row.final_refreshed_ms = Date.parse('2025-12-09T02:00:00Z');
    row.union_refreshed_ms = Date.parse('2025-12-09T03:00:00Z');
  });
  assert.match(context.readinessReason_(metadata, '2025-12-10'), /after the final campaign day/);
});

test('master discovery selects only reported digital lines and rejects a stale master refresh', () => {
  const {context} = harness();
  const sql = context.digitalMetadataSql_();
  assert.match(sql, /FROM `[^`]+ner_master_omnichannel_performance_impressions`/);
  assert.match(sql, /WHERE environment = 'Digital'/);
  assert.match(sql, /FROM digital_report d\s+LEFT JOIN/);
  assert.doesNotMatch(sql, /UNION DISTINCT|WITH eligible AS/);
  const {metadata} = fixture();
  metadata[0].master_refreshed_ms = metadata[0].union_refreshed_ms - 1;
  assert.match(context.readinessReason_(metadata, '2026-01-01'), /master omnichannel table/);
  metadata[0].master_refreshed_ms = null;
  assert.match(context.readinessReason_(metadata, '2026-01-01'), /refresh metadata is missing/);
});

test('all media groups retain distinct TOTALs and BIG W impressions are not multiplied again', () => {
  const {context} = harness();
  const {booking, metadata, performance} = fixture();
  const campaign = context.prepareCampaign_(booking, metadata, performance);
  assert.equal(campaign.groups.length, 2);
  assert.equal(campaign.start, '2025-11-05');
  assert.equal(campaign.end, '2025-12-09');
  const group = campaign.groups[0];
  const table = context.performanceTable_(group, 1);
  assert.equal(table.rows[2].values[2], '160');
  assert.equal(table.rows[2].values[3], '140');
  assert.equal(table.rows[2].values[4], '80');
  assert.equal(table.rows[2].values[5], '1.75');
  group.retailer = 'BIG W';
  assert.equal(context.performanceTable_(group, 1).columns[2][0], 'Total Impressions');
  assert.equal(context.performanceTable_(group, 1).rows[2].values[2], '160');
});

test('missing media results, duplicate TOTALs, missing sections and stale periods fail explicitly', () => {
  const {context} = harness();
  const {booking, metadata, performance} = fixture();
  assert.throws(() => context.prepareCampaign_(booking, metadata,
    performance.filter(row => row.media_type !== 'Metro Digital Screens')), /TOTAL/);
  assert.throws(() => context.prepareCampaign_(booking, metadata,
    performance.concat(performance.find(row => row.section_order === 2))), /TOTAL/);
  assert.throws(() => context.prepareCampaign_(booking, metadata,
    performance.filter(row => row.section_order !== 4)), /Missing Overall Performance by Price/);
  assert.throws(() => context.prepareCampaign_(booking, metadata,
    performance.filter(row => row.dimension_primary !== '2025-12-03 to 2025-12-09')), /stale campaign periods/);
});

test('all result breakdowns exclude unmapped, blank and null dimensions without altering period totals', () => {
  const {context} = harness();
  const {booking, metadata, performance} = fixture();
  for (const order of [3, 4, 5, 6]) {
    const rows = performance.filter(item =>
      item.section_order === order && item.media_type === 'Digital Screens Supers');
    rows[0].dimension_primary = null;
    rows[1].dimension_primary = ' uNmApPeD ';
    rows[2].dimension_primary = '  ';
    if (order === 5) rows[3].dimension_secondary = 'UNMAPPED';
  }
  const mapped = performance.find(item =>
    item.section_order === 3 && item.dimension_primary === 'Segment 3');
  mapped.edr_frequency = null;
  mapped.edr_reach = 0;
  const campaign = context.prepareCampaign_(booking, metadata, performance);
  const group = campaign.groups.find(item => item.mediaType === 'Digital Screens Supers');
  for (const [order, count] of [[3, 4], [4, 0], [5, 7], [6, 4]]) {
    const table = context.performanceTable_(group, order);
    assert.equal(table.rows.length, count);
    table.rows.forEach(row => row.values.forEach(value =>
      assert.notEqual(String(value).trim().toLowerCase(), 'unmapped')));
  }
  const zeroReach = context.performanceTable_(group, 3).rows.find(row =>
    row.values[0] === 'Segment 3');
  assert.equal(zeroReach.values[2], '0');
  assert.equal(zeroReach.values[3], 'N/A');
  assert.equal(context.performanceTable_(group, 1).rows.at(-1).values[2], '160');
});

test('mixed campaigns include digital impressions and clicks without aggregating rows', () => {
  const state = harness();
  Object.assign(state, fixture());
  const digital = digitalFixture();
  state.digitalMetadata = [digital.metadata];
  state.digitalPerformance = [digital.row, {...digital.row, brand: 'Other brand'}];
  state.context.createNERTemplate();
  const result = state.context.runFinishedCampaigns();
  assert.equal(result.created.length, 1);
  assert.equal(result.created[0].mediaGroups, 3);
  const deck = state.decks.get(result.created[0].id);
  assert.equal(deck.slides.length, 16);
  assert.equal(deck.slides.filter(item => item.shapes.some(shape =>
    shape.text.includes('Digital Performance by Period'))).length, 1);
  const slide = deck.slides.find(item => item.shapes.some(shape =>
    shape.text.includes('Digital Performance by Period')));
  assert.ok(slide);
  assert.equal(slide.shapes.filter(shape => shape.text === '1,200').length, 2);
  assert.equal(slide.shapes.filter(shape => shape.text === '23').length, 2);
  assert.ok(slide.shapes.some(shape => shape.text.replace(/\s+/g, ' ') === 'Digital Clicks'));
  assert.equal(slide.shapes.filter(shape => shape.text === '1.92%').length, 2);
  assert.ok(!slide.shapes.some(shape => shape.text === 'TOTAL'));
  assert.ok(deck.slides.some(item => item.shapes.some(shape => shape.text === 'Digital')));
  const resultQueries = state.requests.filter(request => !request.query.startsWith('\nWITH'));
  assert.equal(resultQueries.length, 2);
  resultQueries.forEach(request => assert.ok(
    request.query.includes('ner_master_omnichannel_performance_impressions')));
  assert.ok(resultQueries.some(request => request.query.includes("environment = 'In-Store'") &&
    request.query.includes('brand AS campaign_item_lead_brand')));
  assert.ok(resultQueries.some(request => request.query.includes("environment = 'Digital'") &&
    request.query.includes('dimension_primary AS promotion_week') &&
    request.query.includes('total_impressions AS impressions')));
});

test('digital-only campaigns use media dates and generate a digital section', () => {
  const state = harness();
  const data = fixture();
  const digital = digitalFixture();
  state.metadata = [];
  state.performance = [];
  state.digitalMetadata = [digital.metadata];
  state.digitalPerformance = [digital.row];
  state.context.createNERTemplate();
  const result = state.context.runFinishedCampaigns();
  assert.equal(result.created.length, 1);
  const slides = state.decks.get(result.created[0].id).slides;
  assert.equal(slides.length, 4);
  const cover = slides[0].shapes.map(shape => shape.text).join(' ').replace(/\s+/g, ' ');
  assert.match(cover, /5 Nov 2025 - 9 Dec 2025/);
  assert.ok(slides[3].shapes.some(shape => shape.text === '2025-11-01 to\n2025-11-30' ||
    shape.text === '2025-11-01 to 2025-11-30'));
  assert.equal(data.booking, result.created[0].booking);
});

test('digital campaigns defer incomplete dates and reject unmatched or invalid digital results', () => {
  const state = harness();
  const digital = digitalFixture();
  const data = fixture();
  assert.throws(() => state.context.prepareCampaign_(data.booking, [digital.metadata], [], []),
    /Master digital result no longer matches/);
  assert.throws(() => state.context.prepareCampaign_(data.booking, [digital.metadata], [],
    [{...digital.row, line_name: 'Other'}]), /no matching campaign media/);
  assert.throws(() => state.context.prepareCampaign_(data.booking, [digital.metadata], [],
    [{...digital.row, digital_clicks: null}]), /missing or invalid/);
  const missingDate = {...digital.metadata, media_end_date: null};
  assert.match(state.context.readinessReason_([missingDate], '2026-01-01'), /invalid media dates/);
  assert.equal(state.context.readinessReason_([digital.metadata], '2025-12-09').includes('still live'), true);
  const stale = {...digital.metadata, union_refreshed_ms: 1};
  assert.match(state.context.readinessReason_([stale], '2026-01-01'), /combined final table/);
});

test('all digital media share a slide using only returned master rows', () => {
  const state = harness();
  const data = fixture();
  const digital = digitalFixture();
  state.metadata = [];
  state.performance = [];
  state.digitalMetadata = [
    digital.metadata,
    {...digital.metadata, media_type: 'Big W - Event', line_name: 'Event A'}
  ];
  state.digitalPerformance = [digital.row,
    {...digital.row, media_type: 'Big W - Event', line_name: 'Event A'}];
  state.context.createNERTemplate();
  const result = state.context.runFinishedCampaigns();
  assert.equal(result.created.length, 1);
  const deck = state.decks.get(result.created[0].id);
  const digitalSlides = deck.slides.filter(slide =>
    slide.shapes.some(shape => shape.text.includes('Digital Performance by Period')));
  assert.equal(digitalSlides.length, 1);
  const slide = digitalSlides[0];
  assert.ok(slide.shapes.every(shape => !shape.text.includes('INCOMPLETE')));
  assert.equal(slide.shapes.filter(shape => shape.text === 'Homepage B').length, 0);
  assert.ok(slide.shapes.every(shape => !shape.text.includes('Not available')));
  assert.ok(slide.shapes.some(shape => shape.text === '1,200'));
  assert.ok(slide.shapes.some(shape => shape.text === '23'));
  assert.ok(slide.shapes.some(shape => shape.text === '1.92%'));
  assert.ok(slide.shapes.some(shape => shape.text === 'Event A'));
  assert.ok(slide.shapes.some(shape => shape.text.replace(/\s+/g, ' ') === 'Big W - Event'));
  assert.ok(slide.shapes.some(shape => shape.text.replace(/\s+/g, ' ') === 'Big W - Homepage'));
  assert.ok(slide.shapes.every(shape => shape.text !== '0'));
  assert.equal(data.booking, result.created[0].booking);
});

test('digital table uses the requested columns, computes CTR and handles zero impressions', () => {
  const {context} = harness();
  const digital = digitalFixture();
  const groups = context.prepareDigitalGroups_('WOW-TEST', [digital.metadata], [
    digital.row, {...digital.row, impressions: 0, digital_clicks: 0}
  ]);
  const table = context.digitalPerformanceTable_(groups);
  assert.deepEqual(Array.from(table.columns, column => column[0]), [
    'Campaign Period', 'Line Name', 'Media Type', 'Total Impressions',
    'Digital Clicks', 'CTR (Digital Clicks / Impressions)'
  ]);
  assert.deepEqual(Array.from(table.rows[0].values), [
    '2025-11-01 to 2025-11-30', 'Homepage A', 'Big W - Homepage', '1,200', '23', '1.92%'
  ]);
  assert.equal(table.rows[1].values[5], 'N/A');
});

test('fifteen booked lines across digital media types fit on one slide without omitting data', () => {
  const state = harness();
  const digital = digitalFixture();
  state.metadata = [];
  state.performance = [];
  state.digitalMetadata = [];
  state.digitalPerformance = [];
  for (let i = 0; i < 15; i++) {
    const mediaType = i < 9 ? 'Big W - Department Page Takeover' : 'Big W - Homepage';
    const line = 'CI-106240' + (75 + i);
    state.digitalMetadata.push({...digital.metadata, media_type: mediaType, line_name: line});
    state.digitalPerformance.push({...digital.row, media_type: mediaType, line_name: line});
  }
  state.context.createNERTemplate();
  const result = state.context.runFinishedCampaigns();
  const deck = state.decks.get(result.created[0].id);
  const slides = deck.slides.filter(slide =>
    slide.shapes.some(shape => shape.text.includes('Digital Performance by Period')));
  assert.equal(slides.length, 1);
  for (const item of state.digitalMetadata) {
    assert.ok(slides[0].shapes.some(shape => shape.text === item.line_name), item.line_name);
  }
  assert.ok(slides[0].shapes.filter(shape => shape.objectId).every(shape => shape.y + shape.height <= 374));
});

test('oversized digital results paginate without dropping any media or rows', () => {
  const {context} = harness();
  const digital = digitalFixture();
  const rows = Array.from({length: 40}, (_, index) => ({
    ...digital.row, line_name: 'Line ' + index
  }));
  const table = context.digitalPerformanceTable_([{mediaType: digital.metadata.media_type, rows}]);
  const layout = context.digitalLayout_(table);
  assert.ok(layout.pages.length > 1);
  assert.equal(layout.pages.flat().length, 40);
  layout.pages.forEach(page => assert.ok(
    layout.top + 33 + page.reduce((height, row) => height + row.height, 0) <= 374));
});

test('all-unmapped sections keep their slide, headers and an explicit empty-state message', () => {
  const state = harness();
  const data = fixture();
  data.performance.filter(row => row.section_order === 4 &&
    row.media_type === 'Digital Screens Supers').forEach(row => {
    row.dimension_primary = 'Unmapped';
  });
  // The source is grouped by dimension; a single Unmapped row represents this section.
  let retained = false;
  data.performance = data.performance.filter(row => {
    if (row.section_order !== 4 || row.media_type !== 'Digital Screens Supers') return true;
    if (retained) return false;
    retained = true;
    return true;
  });
  Object.assign(state, data);
  state.context.createNERTemplate();
  const result = state.context.runFinishedCampaigns();
  const deck = state.decks.get(result.created[0].id);
  assert.equal(deck.slides.length, 14);
  const slide = deck.slides.find(item => item.shapes.some(shape =>
    shape.text === 'No mapped results available'));
  assert.ok(slide);
  assert.ok(slide.shapes.some(shape => shape.text.includes('Price Segments')));
  assert.ok(!slide.shapes.some(shape => shape.text.trim().toLowerCase() === 'unmapped'));
});

test('media schedule marks investment fields as missing, not as zero or active-store counts', () => {
  const {context} = harness();
  const data = fixture();
  const campaign = context.prepareCampaign_(data.booking, data.metadata, data.performance);
  const row = context.scheduleRows_(campaign)[0].values;
  assert.equal(row[5], 'Not supplied');
  assert.deepEqual(Array.from(row.slice(7)), Array(4).fill('Not supplied'));
  assert.equal(row[3], '5 Nov 2025');
});

test('media schedule uses Supers banner and media_type as Ad Format without changing result labels', () => {
  const {context} = harness();
  const data = fixture();
  const campaign = context.prepareCampaign_(data.booking, data.metadata, data.performance);
  const schedule = context.scheduleRows_(campaign);
  const supers = schedule.find(row => row.values[0] === 'Supers');
  assert.ok(supers);
  assert.equal(supers.values[2], 'Digital Screens Supers');
  assert.ok(schedule.some(row => row.values[0] === 'Metro Stores' &&
    row.values[2] === 'Metro Digital Screens'));
  assert.ok(campaign.groups.some(group => group.networkLabel.startsWith('Supermarkets |')));
  const digital = digitalFixture();
  const digitalCampaign = context.prepareCampaign_(data.booking, [digital.metadata], [], [digital.row]);
  const digitalSchedule = context.scheduleRows_(digitalCampaign)[0].values;
  assert.equal(digitalSchedule[0], 'BIG W');
  assert.equal(digitalSchedule[2], 'Big W - Homepage');
});

test('media schedule keeps Channel and its values on one line within the table width', () => {
  const state = harness();
  Object.assign(state, fixture());
  state.context.createNERTemplate();
  const result = state.context.runFinishedCampaigns();
  const deck = state.decks.get(result.created[0].id);
  const cells = deck.slides[1].shapes.filter(shape => shape.objectId);
  const header = cells.find(shape => shape.text === 'Channel');
  assert.ok(header, 'Channel header must not contain inserted line breaks');
  for (const value of ['Channel', 'Instore', 'Digital']) {
    assert.equal(state.context.wrapText_(value, header.width - 8, header.size), value);
  }
  assert.ok(cells.some(shape => shape.x === header.x && shape.text === 'Instore'));
  const headers = cells.filter(shape => shape.y === header.y);
  assert.ok(Math.abs(headers.reduce((width, shape) => width + shape.width, 0) - 620) < 0.001);
  assert.ok(cells.every(shape => shape.x + shape.width <= 675.001));
});

test('pagination preserves every row, fits the slide and keeps eleven geography rows together', () => {
  const {context} = harness();
  const columns = [['State', 0.5], ['Impressions', 0.5]];
  const rows = Array.from({length: 35}, (_, index) => ({values: ['NSW', String(index)]}));
  const pages = context.paginateTable_(columns, rows, 480, 262, 7.4, 20);
  assert.equal(pages.length, 4);
  assert.equal(pages[0].length, 11);
  assert.equal(pages.flat().length, 35);
  pages.forEach(page => {
    assert.ok(103 + 33 + page.reduce((height, row) => height + row.height, 0) <= 365);
  });
});

test('geographical split compacts fifteen rows onto one slide without dropping values', () => {
  const state = harness();
  const data = fixture();
  const groupRows = data.performance.filter(row => row.section_order === 5 &&
    row.media_type === 'Digital Screens Supers');
  for (let i = 11; i < 15; i++) {
    data.performance.push({...groupRows[0], dimension_primary: 'State' + i,
      dimension_secondary: 'Metro', total_impressions: 100 + i});
  }
  Object.assign(state, data);
  state.context.createNERTemplate();
  const result = state.context.runFinishedCampaigns();
  const deck = state.decks.get(result.created[0].id);
  assert.equal(deck.slides.length, 14);
  const geoSlides = deck.slides.filter(slide =>
    slide.shapes.some(shape => shape.text.includes('Geographical State and Metro/Regional Split')) &&
    slide.shapes.some(shape => shape.title === 'NETWORK' && shape.text.includes('Digital Screens Supers')));
  assert.equal(geoSlides.length, 1);
  const slide = geoSlides[0];
  for (let i = 0; i < 15; i++) {
    assert.ok(slide.shapes.some(shape => shape.text === (i < 11 ? 'Segment ' + i : 'State' + i)));
  }
  assert.ok(slide.shapes.filter(shape => shape.objectId).every(shape => shape.y + shape.height <= 374));
  assert.ok(slide.shapes.some(shape => shape.objectId && shape.size === 5.5));
});

test('geographical split still paginates without dropping rows beyond the compact limit', () => {
  const {context} = harness();
  const table = {columns: [['State', 0.5], ['Impressions', 0.5]],
    rows: Array.from({length: 40}, (_, index) => ({values: ['NSW', String(index)]}))};
  const layout = context.performanceLayout_(table, 5);
  assert.ok(layout.pages.length > 1);
  assert.equal(layout.pages.flat().length, 40);
  layout.pages.forEach(page => {
    assert.ok(layout.top + 33 + page.reduce((height, row) => height + row.height, 0) <= 374);
  });
});

test('eight-slide template generates one 14-slide deck for two media types and skips duplicates', () => {
  const state = harness();
  const data = fixture();
  Object.assign(state, data);
  const templateId = state.context.createNERTemplate();
  assert.equal(state.decks.get(templateId).slides.length, 8);
  assert.equal(state.context.createNERTemplate(), templateId);
  const result = state.context.runFinishedCampaigns();
  assert.equal(result.created.length, 1);
  assert.equal(result.created[0].slideCount, 14);
  assert.equal(result.created[0].mediaGroups, 2);
  const deck = state.decks.get(result.created[0].id);
  assert.ok(deck.saved);
  assert.equal(deck.slides.length, 14);
  const cover = deck.slides[0].shapes.map(shape => shape.text).join(' ');
  assert.match(cover, /AMEX FOS Screens/);
  assert.match(cover.replace(/\s+/g, ' '), /5 Nov 2025 - 9 Dec 2025/);
  deck.slides.forEach(slide => slide.shapes.forEach(shape => {
    assert.doesNotMatch(shape.text, /\{\{/);
    assert.ok(shape.y + shape.height <= 405);
  }));
  const second = state.context.runFinishedCampaigns();
  assert.equal(second.created.length, 0);
  assert.equal(second.skipped.length, 1);
  assert.equal(state.decks.size, 2);
  assert.ok(state.batches.length > 1, 'Tables should use bounded batch requests');
  state.batches.forEach(batch => assert.ok(batch.length <= 400));
  assert.ok(deck.slides.some(slide => slide.shapes.some(shape => shape.text === '160')));
});

test('real Slides trailing paragraph terminator does not make the Fresh Screen Network label overflow', () => {
  const state = harness();
  const data = fixture();
  data.metadata.concat(data.performance).forEach(row => {
    if (row.media_type === 'Digital Screens Supers') row.media_type = 'Fresh Screen Network';
  });
  Object.assign(state, data);
  state.context.createNERTemplate();
  const result = state.context.runFinishedCampaigns();
  assert.equal(result.created.length, 1);
  const deck = state.decks.get(result.created[0].id);
  const label = deck.slides.flatMap(slide => slide.shapes).find(shape =>
    shape.title === 'NETWORK' && shape.height === 23 && shape.text.includes('Fresh Screen Network'));
  assert.ok(label);
  assert.equal(label.text, 'Supermarkets | Fresh Screen Network');
  assert.equal(label.size, 11.5);
});

test('an unfinished media line prevents any deck from being generated', () => {
  const state = harness();
  Object.assign(state, fixture());
  state.metadata[0].campaign_end_date = '2099-12-31';
  state.context.createNERTemplate();
  const result = state.context.runFinishedCampaigns();
  assert.equal(result.created.length, 0);
  assert.equal(result.deferred.length, 1);
  assert.equal(state.decks.size, 1);
});

test('interrupted builds retry only their marked generated deck, never the template', () => {
  const state = harness();
  Object.assign(state, fixture());
  const templateId = state.context.createNERTemplate();
  state.failRename = true;
  assert.throws(() => state.context.runFinishedCampaigns(), /Simulated Drive rename failure/);
  const failed = Array.from(state.files.values()).find(file => file.name.startsWith('[BUILDING]'));
  assert.ok(failed);
  const result = state.context.runFinishedCampaigns();
  assert.equal(result.created.length, 1);
  assert.equal(state.files.get(failed.id).trashed, true);
  assert.equal(state.files.get(templateId).trashed, false);
  assert.notEqual(result.created[0].id, failed.id);
});

test('BigQuery polls and paginates without dropping rows and preserves numeric nulls', () => {
  const state = harness();
  const {context} = state;
  const fields = [
    {name: 'booking_number', type: 'STRING'},
    {name: 'edr_reach', type: 'INTEGER'},
    {name: 'edr_frequency', type: 'FLOAT'}
  ];
  context.BigQuery.Jobs.query = () => ({
    jobComplete: false, jobReference: {jobId: 'async-job', location: 'australia-southeast1'}
  });
  const calls = [];
  context.BigQuery.Jobs.getQueryResults = (project, job, options) => {
    calls.push(options);
    return options.pageToken
      ? {jobComplete: true, rows: [{f: [{v: 'B'}, {v: '0'}, {v: null}]}]}
      : {jobComplete: true, schema: {fields}, pageToken: 'next',
        rows: [{f: [{v: 'A'}, {v: '100'}, {v: '1.75'}]}]};
  };
  const rows = context.queryRows_('SELECT ...', []);
  assert.equal(rows.length, 2);
  assert.equal(rows[0].edr_reach, 100);
  assert.equal(rows[0].edr_frequency, 1.75);
  assert.equal(rows[1].edr_frequency, null);
  assert.equal(calls[1].pageToken, 'next');
  assert.equal(calls[1].location, 'australia-southeast1');
});

test('query errors and unsafe numeric values are surfaced', () => {
  const {context} = harness();
  context.BigQuery.Jobs.query = () => ({
    jobComplete: true, jobReference: {jobId: 'error'},
    errors: [{message: 'Permission denied'}]
  });
  assert.throws(() => context.queryRows_('SELECT ...', []), /Permission denied/);
  assert.throws(() => context.decodeRows_([{name: 'edr_reach', type: 'INTEGER'}],
    [{f: [{v: '9007199254740993'}]}]), /Unsafe/);
});

test('daily trigger installation is idempotent', () => {
  const state = harness();
  state.context.createNERTemplate();
  state.context.installDailyTrigger();
  state.context.installDailyTrigger();
  assert.equal(state.triggers.length, 1);
});
