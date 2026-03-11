import Imap from 'imap';

const GMAIL_PASSWORD = process.env.GMAIL_APP_PASSWORD?.replace(/\s/g, '');
const GMAIL_USER = 'brian@homegrownpropertygroup.com';

const imap = new Imap({
  user: GMAIL_USER,
  password: GMAIL_PASSWORD,
  host: 'imap.gmail.com',
  port: 993,
  tls: true,
  tlsOptions: { rejectUnauthorized: false }
});

imap.once('ready', () => {
  imap.openBox('INBOX', true, (err, box) => {
    if (err) { console.error('openBox error:', err); imap.end(); return; }
    
    // Search for Sikes Mill emails specifically
    imap.search([['FROM', 'callcenter@showingtime.com'], ['SUBJECT', '1131']], (err, results) => {
      if (err) { console.error('search error:', err); imap.end(); return; }
      
      console.log(`Found ${results.length} Sikes Mill emails`);
      
      if (results.length === 0) {
        // Try broader search
        imap.search([['FROM', 'callcenter@showingtime.com'], ['SUBJECT', 'Sikes']], (err2, results2) => {
          console.log(`Found ${results2?.length || 0} with "Sikes" in subject`);
          
          // Just grab first 3 emails and show subjects
          imap.search([['FROM', 'callcenter@showingtime.com']], (err3, all) => {
            const sample = all.slice(-3);
            const f = imap.fetch(sample, { bodies: 'HEADER.FIELDS (SUBJECT FROM DATE)' });
            f.on('message', (msg) => {
              msg.on('body', (stream) => {
                let data = '';
                stream.on('data', d => data += d.toString());
                stream.on('end', () => console.log('SUBJECT:', data.split('\r\n').find(l => l.startsWith('Subject:'))));
              });
            });
            f.once('end', () => imap.end());
          });
        });
        return;
      }
      
      // Fetch first Sikes Mill email body
      const f = imap.fetch(results.slice(-1), { bodies: ['HEADER', 'TEXT'] });
      f.on('message', (msg) => {
        let headers = '';
        let body = '';
        msg.on('body', (stream, info) => {
          let data = '';
          stream.on('data', d => data += d.toString());
          stream.on('end', () => {
            if (info.which === 'HEADER') headers = data;
            else body = data;
          });
        });
        msg.once('end', () => {
          console.log('HEADERS:', headers.substring(0, 500));
          // Decode QP
          const decoded = body.replace(/=\r?\n/g, '').replace(/=([0-9A-Fa-f]{2})/g, (_, h) => String.fromCharCode(parseInt(h, 16)));
          // Look for MLS patterns
          const mlsPatterns = [
            decoded.match(/MLS[#\s:]*(\d{6,8})/i),
            decoded.match(/ID#\s*(\d+)/i),
            decoded.match(/Listing[#\s:]*(\d{6,8})/i),
            decoded.match(/4346944/),
          ];
          console.log('MLS PATTERNS:', mlsPatterns.map(m => m?.[0] || null));
          // Show 500 chars of decoded body around any address mention
          const addrIdx = decoded.indexOf('1131');
          if (addrIdx > 0) {
            console.log('BODY AROUND ADDRESS:', decoded.substring(Math.max(0, addrIdx-100), addrIdx+400));
          } else {
            console.log('BODY SAMPLE:', decoded.substring(0, 800));
          }
        });
      });
      f.once('end', () => imap.end());
    });
  });
});

imap.once('error', err => console.error('IMAP error:', err));
imap.connect();
