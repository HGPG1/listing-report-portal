#!/bin/bash

echo "Testing ListTrac sync mutation directly..."

curl -X POST http://localhost:3000/api/trpc/listtrac.syncListing?batch=1 \
  -H "Content-Type: application/json" \
  -H "Cookie: session=test" \
  -d '{
    "0": {
      "json": {
        "listingId": 1,
        "daysBack": 7
      }
    }
  }' \
  -v
