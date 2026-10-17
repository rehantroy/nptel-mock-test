// buildHciAll.cjs: Aggregator for HCI Question Bank
const fs = require('fs');
const path = require('path');

const weeks = [];
for (let w = 1; w <= 12; w++) {
  const weekData = require(`./hci-weeks/week${w}.cjs`);
  weeks.push({ week: w, questions: weekData });
}

console.log(`Loaded ${weeks.length} HCI week modules.`);
