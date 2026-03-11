import Imap from "imap";
import { simpleParser } from "mailparser";

const GMAIL_USER = "brian@homegrownpropertygroup.com";
const GMAIL_PASSWORD = "ivid kztk exov jbgt";

console.log("Starting IMAP debug...");
console.log(`Connecting to ${GMAIL_USER}`);

const imap = new Imap({
  user: GMAIL_USER,
  password: GMAIL_PASSWORD,
  host: "imap.gmail.com",
  port: 993,
  tls: true,
  tlsOptions: { rejectUnauthorized: false },
});

imap.on("ready", () => {
  console.log("✓ Connected to Gmail IMAP");
  
  // List all mailboxes
  imap.getBoxes((err, boxes) => {
    if (err) {
      console.error("Error listing boxes:", err);
      imap.end();
      return;
    }
    
    console.log("\n📁 Available mailboxes:");
    const listBoxes = (boxes, prefix = "") => {
      Object.keys(boxes).forEach(key => {
        const box = boxes[key];
        console.log(`  ${prefix}${key}`);
        if (box.children) {
          listBoxes(box.children, prefix + "  ");
        }
      });
    };
    listBoxes(boxes);
    
    // Open INBOX
    imap.openBox("INBOX", false, (err, mailbox) => {
      if (err) {
        console.error("\n✗ Failed to open INBOX:", err.message);
        imap.end();
        return;
      }
      
      console.log(`\n✓ Opened INBOX (${mailbox.messages.total} total messages)`);
      
      // Search for ShowingTime emails
      console.log("\nSearching for ShowingTime emails...");
      
      // Try different search approaches
      console.log("\n1️⃣ Search by FROM field:");
      imap.search([["FROM", "callcenter@showingtime.com"]], (err, results) => {
        if (err) {
          console.error("Error:", err.message);
        } else {
          console.log(`   Found ${results.length} emails from callcenter@showingtime.com`);
        }
        
        console.log("\n2️⃣ Search by SUBJECT CONFIRMED:");
        imap.search([["SUBJECT", "CONFIRMED"]], (err, results) => {
          if (err) {
            console.error("Error:", err.message);
          } else {
            console.log(`   Found ${results.length} emails with CONFIRMED in subject`);
          }
          
          console.log("\n3️⃣ Search by SUBJECT INSPECTION:");
          imap.search([["SUBJECT", "INSPECTION"]], (err, results) => {
            if (err) {
              console.error("Error:", err.message);
            } else {
              console.log(`   Found ${results.length} emails with INSPECTION in subject`);
              
              if (results.length > 0) {
                console.log("\n📧 Fetching first email to inspect...");
                const f = imap.fetch(results.slice(0, 1), { bodies: "" });
                
                f.on("message", (msg) => {
                  simpleParser(msg, (err, parsed) => {
                    if (err) {
                      console.error("Parse error:", err);
                    } else {
                      console.log("\nFirst email details:");
                      console.log(`  From: ${parsed.from.text}`);
                      console.log(`  Subject: ${parsed.subject}`);
                      console.log(`  Text preview: ${(parsed.text || "").substring(0, 200)}`);
                    }
                    imap.end();
                  });
                });
                
                f.on("error", (err) => {
                  console.error("Fetch error:", err);
                  imap.end();
                });
              } else {
                imap.end();
              }
            }
          });
        });
      });
    });
  });
});

imap.on("error", (err) => {
  console.error("✗ IMAP error:", err.message);
  if (err.message.includes("self-signed")) {
    console.log("\n⚠️  SSL certificate issue. Retrying with TLS options...");
  }
  process.exit(1);
});

imap.on("end", () => {
  console.log("\n✓ Connection closed");
  process.exit(0);
});

imap.connect();
