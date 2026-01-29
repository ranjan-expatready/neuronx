const fs = require('fs');
const path = require('path');

const QUARANTINE_FILE = path.join(__dirname, '../docs/ship_readiness/QUARANTINE_LIST.md');
const BASELINE_FILE = path.join(__dirname, '../docs/ship_readiness/quarantine-baseline.json');

function checkQuarantine() {
    console.log('🔍 Checking Quarantine Ratchet & Metadata...');

    if (!fs.existsSync(QUARANTINE_FILE)) {
        console.error('❌ Error: QUARANTINE_LIST.md not found.');
        process.exit(1);
    }

    const content = fs.readFileSync(QUARANTINE_FILE, 'utf8');
    const lines = content.split('\n');
    
    let tableStart = -1;
    for (let i = 0; i < lines.length; i++) {
        if (lines[i].trim().startsWith('| Target | Category | Reason | Tracking ID | Owner |')) {
            tableStart = i;
            break;
        }
    }

    if (tableStart === -1) {
        // Fallback for old header or if table is missing
        console.error('❌ Error: Quarantine table header not found or invalid format.');
        console.error('Expected: | Target | Category | Reason | Tracking ID | Owner | ...');
        process.exit(1);
    }

    const rows = lines.slice(tableStart + 2).filter(line => line.trim().startsWith('|'));
    
    const entries = [];
    let errors = 0;

    rows.forEach((row, index) => {
        const cols = row.split('|').map(c => c.trim()).filter(c => c !== '');
        // Expecting at least 5 columns: Target, Category, Reason, Tracking ID, Owner. Date is 6th.
        // The split will give empty strings at start/end if pipe is at start/end.
        // Let's rely on filter(c => c !== '').
        // Actually, let's be more precise.
        
        const cells = row.split('|').slice(1, -1).map(c => c.trim());
        
        if (cells.length < 5) {
             console.error(`❌ Row ${index + 1}: Missing columns. Found ${cells.length}, expected at least 5.`);
             errors++;
             return;
        }

        const [target, category, reason, trackingId, owner] = cells;

        if (!target || !category || !trackingId || !owner) {
            console.error(`❌ Row ${index + 1}: Missing required metadata.`);
            if (!target) console.error('   - Missing Target');
            if (!category) console.error('   - Missing Category');
            if (!trackingId) console.error('   - Missing Tracking ID');
            if (!owner) console.error('   - Missing Owner');
            errors++;
        }

        entries.push({ target, category, trackingId, owner });
    });

    if (errors > 0) {
        console.error(`❌ Found ${errors} metadata errors.`);
        process.exit(1);
    }

    const currentCount = entries.length;
    console.log(`✅ Metadata check passed for ${currentCount} quarantined items.`);

    // Ratchet Check
    if (!fs.existsSync(BASELINE_FILE)) {
        console.warn('⚠️  Baseline file not found. Creating new baseline...');
        fs.writeFileSync(BASELINE_FILE, JSON.stringify({ baseline_count: currentCount }, null, 2));
    }

    const baselineConfig = JSON.parse(fs.readFileSync(BASELINE_FILE, 'utf8'));
    const baselineCount = baselineConfig.baseline_count;

    console.log(`📊 Quarantine Status: Current=${currentCount}, Baseline=${baselineCount}`);

    if (currentCount > baselineCount) {
        console.error(`❌ RATCHET FAILURE: Quarantine count (${currentCount}) exceeds baseline (${baselineCount}).`);
        console.error('   You cannot add new quarantined items without fixing existing ones or explicitly updating the baseline.');
        process.exit(1);
    } else if (currentCount < baselineCount) {
        console.log(`🎉 IMPROVEMENT: Quarantine count (${currentCount}) is lower than baseline (${baselineCount}).`);
        console.log('   Please update docs/ship_readiness/quarantine-baseline.json to lock in this improvement!');
        // Optional: fail to force update? Or just warn. User said "ratchet", usually implies automatic or forced.
        // User constraints: "Implement quarantine ratchet: CI must fail if quarantined test count increases beyond current baseline."
        // Doesn't say fail if it decreases. I'll just warn.
    } else {
        console.log('✅ Quarantine count within baseline.');
    }
}

checkQuarantine();
