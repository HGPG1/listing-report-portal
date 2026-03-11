#!/usr/bin/env node

import Imap from 'imap';
import { simpleParser } from 'mailparser';
import { createConnection } from 'mysql2/promise';

const GMAIL_USER = 'brian@homegrownpropertygroup.com';
const GMAIL_PASSWORD = process.env.GMAIL_APP_PASSWORD;

async function getDbConnection() {
  return createConnection({
    host: process.env.DATABASE_URL?.split('@')[1]?.split('/')[0] || 'localhost',
    user: process.env.DATABASE_URL?.split('//')[1]?.split(':')[0] || 'root',
    password: process.env.DATABASE_URL?.split(':')[1]?.split('@')[0] || '',
    database: process.env.DATABASE_URL?.split('/').pop() || 'listing_portal',
  });
}

function parseShowingTimeEmail(html) {
  const data = {
    address: null,
    mls: null,
    showingTime: null,
    status: 'requested',
  };

  const mlsMatch = html.match(/ID#\s*(\d+)/);
  if (mlsMatch) {
    data.mls = mlsMatch[1];
  }

  const addressMatch = html.match(/<b[^>]*>(\d+\s+[^<]+(?:Road|Drive|Street|Avenue|Lane|Court|Way))<\/b>/i);
  if (addressMatch) {
    data.address = addressMatch[1].trim();
  }

  const dateMatch = html.match(/([A-Za-z]+day,\s+[A-Za-z]+\s+\d+,\s+\d{4})/);
  const timeMatch = html.match(/(\d{1,2}:\d{2}\s*(?:AM|PM))/i);

  if (dateMatch && timeMatch) {
    try {
      data.showingTime = new Date(`${dateMatch[1]} ${timeMatch[1]}`);
    } catch (e) {
      console.error('Date parse error:', e);
    }
  }

  if (html.includes('CONFIRMED') || html.includes('Confirmed')) {
    data.status = 'confirmed';
  } else if (html.includes('RESCHEDULE') || html.includes('Rescheduled')) {
    data.status = 'rescheduled';
  }

  return data;
}

async function importShowingTimeEmails() {
  console.log('Starting ShowingTime bulk import from January 1, 2026...');

  const db = await getDbConnection();
  const stats = { fetched: 0, parsed: 0, imported: 0, errors: [] };

  return new Promise((resolve) => {
    const imap = new Imap({
      user: GMAIL_USER,
      password: GMAIL_PASSWORD,
      host: 'imap.gmail.com',
      port: 993,
      tls: true,
    });

    imap.on('ready', () => {
      console.log('IMAP connected');
      imap.openBox('[Gmail]/All Mail', false, async (err) => {
        if (err) {
          console.error('Failed to open All Mail:', err.message);
          imap.end();
          return resolve(stats);
        }

        imap.search(['SINCE', '1-Jan-2026'], async (err, results) => {
          if (err) {
            console.error('Search failed:', err.message);
            imap.end();
            return resolve(stats);
          }

          stats.fetched = results.length;
          console.log(`Found ${results.length} emails since Jan 1`);

          if (results.length === 0) {
            imap.end();
            return resolve(stats);
          }

          const f = imap.fetch(results, { bodies: '' });
          let processed = 0;

          f.on('message', (msg) => {
            simpleParser(msg, async (err, parsed) => {
              if (err) {
                stats.errors.push(`Parse error: ${err.message}`);
                return;
              }

              const html = parsed.html || parsed.text || '';
              if (!html.includes('ShowingTime') && !html.includes('CONFIRMED') && !html.includes('RESCHEDULE')) {
                processed++;
                return;
              }

              const showingData = parseShowingTimeEmail(html);
              if (showingData.mls) {
                stats.parsed++;

                try {
                  const [listings] = await db.query('SELECT id FROM listings WHERE mlsNumber = ?', [showingData.mls]);
                  const listingId = listings.length > 0 ? listings[0].id : 1;

                  const messageId = parsed.messageId || `${showingData.mls}-${showingData.showingTime?.getTime()}`;
                  const [existing] = await db.query('SELECT id FROM showingRequests WHERE emailMessageId = ?', [messageId]);

                  if (existing.length === 0) {
                    await db.query(
                      'INSERT INTO showingRequests (listingId, address, mlsNumber, requestedTime, status, emailMessageId, emailSubject) VALUES (?, ?, ?, ?, ?, ?, ?)',
                      [listingId, showingData.address || '', showingData.mls, showingData.showingTime, showingData.status, messageId, parsed.subject]
                    );
                    stats.imported++;
                  }
                } catch (dbErr) {
                  stats.errors.push(`DB error: ${dbErr instanceof Error ? dbErr.message : String(dbErr)}`);
                }
              }

              processed++;
              if (processed % 20 === 0) {
                console.log(`Processed ${processed}/${results.length}...`);
              }

              if (processed === results.length) {
                imap.end();
                db.end();
                console.log('\n=== Import Complete ===');
                console.log(`Fetched: ${stats.fetched}, Parsed: ${stats.parsed}, Imported: ${stats.imported}`);
                if (stats.errors.length > 0) {
                  console.log(`Errors: ${stats.errors.length}`);
                }
                resolve(stats);
              }
            });
          });

          f.on('error', (err) => {
            console.error('Fetch error:', err.message);
            imap.end();
            db.end();
            resolve(stats);
          });
        });
      });
    });

    imap.on('error', (err) => {
      console.error('IMAP error:', err.message);
      stats.errors.push(`IMAP error: ${err.message}`);
      imap.end();
      db.end();
      resolve(stats);
    });

    imap.openBox = imap.openBox.bind(imap);
  });
}

importShowingTimeEmails().then(() => {
  process.exit(0);
}).catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
