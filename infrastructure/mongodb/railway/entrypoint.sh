#!/bin/bash
set -e

# Start mongod in background with Replica Set enabled
echo "🚀 Starting mongod with Replica Set rs0..."
mongod --replSet rs0 --bind_ip_all &
MONGOD_PID=$!

# Wait for MongoDB to become ready
echo "⏳ Waiting for MongoDB to start on port 27017..."
until mongosh --eval "db.adminCommand('ping')" --quiet >/dev/null 2>&1; do
  sleep 1
done

# Initialize Replica Set if not already initialized
echo "🔧 Checking Replica Set initialization status..."
mongosh --eval '
try {
  const status = rs.status();
  if (status.ok === 1) {
    console.log("✔ Replica Set rs0 is already initiated.");
  }
} catch (e) {
  console.log("⚡ Initiating Replica Set rs0 for Railway Private Network...");
  rs.initiate({
    _id: "rs0",
    members: [{ _id: 0, host: "localhost:27017" }]
  });
  console.log("✔ Replica Set rs0 initiated successfully.");
}
' --quiet

echo "🎉 MongoDB Replica Set is fully active and accepting transactions!"

# Wait for background mongod process so container stays alive
wait $MONGOD_PID
