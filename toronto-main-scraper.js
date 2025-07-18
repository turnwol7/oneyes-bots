require("dotenv").config();
const fs = require("fs");
const path = require("path");

const CITY = "toronto";

// Configuration for Toronto scrapers
const torontoScrapers = {
    jobs: [
        {
            name: "toronto-techto-jobs",
            webhook: `${CITY.toUpperCase()}_JOBS_WEBHOOK_URL`
        }
    ],
    events: [
        {
            name: "toronto-techto-events", 
            webhook: `${CITY.toUpperCase()}_EVENTS_WEBHOOK_URL`
        }
    ]
};

async function runCityScrapers(cityName) {
    const cityConfig = torontoScrapers;
    if (!cityConfig) {
        console.error(`No configuration found for city: ${cityName}`);
        return;
    }

    console.log(`=== Running ${cityName.charAt(0).toUpperCase() + cityName.slice(1)} Scrapers ===\n`);

    // Run job scrapers
    console.log("--- Running Job Scrapers ---");
    for (const scraper of cityConfig.jobs) {
        try {
            console.log(`\n🔄 Running ${scraper.name}...`);
            const scraperModule = require(`./scrapers/${cityName}/${scraper.name}.js`);
            console.log(`✅ Completed ${scraper.name}`);
        } catch (error) {
            console.error(`❌ Error running ${scraper.name}:`, error.message);
        }
    }

    // Run events scrapers  
    console.log("\n--- Running Events Scrapers ---");
    for (const scraper of cityConfig.events) {
        try {
            console.log(`\n🔄 Running ${scraper.name}...`);
            const scraperModule = require(`./scrapers/${cityName}/${scraper.name}.js`);
            console.log(`✅ Completed ${scraper.name}`);
        } catch (error) {
            console.error(`❌ Error running ${scraper.name}:`, error.message);
        }
    }

    console.log(`\n✅ All ${cityName} scrapers completed!`);
}

// Run the main function
runCityScrapers(CITY);
