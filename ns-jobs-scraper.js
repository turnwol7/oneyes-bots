require("dotenv").config();
const axios = require("axios");
const fs = require("fs");
const cheerio = require("cheerio");

const NS_JOBS_URL = "https://jobs.novascotia.ca/go/All-Opportunities/502817/?q=&q2=&alertId=&locationsearch=&title=&facility=cyber&location=&shifttype=";
const NS_JOBS_FILE = "NS-jobs.json";

process.on('unhandledRejection', (error) => {
    console.error('Unhandled promise rejection:', error);
    process.exit(1);
});

async function scrapeNSJobs() {
    try {
        console.log("Fetching Nova Scotia government jobs from:", NS_JOBS_URL);
        const { data } = await axios.get(NS_JOBS_URL);
        const $ = cheerio.load(data);
        let jobs = [];

        $("tr.data-row").each((i, el) => {
            const $row = $(el);
            // Job title and link
            const titleLink = $row.find("a.jobTitle-link");
            const title = titleLink.text().trim();
            const link = titleLink.attr("href") ? `https://jobs.novascotia.ca${titleLink.attr("href")}` : null;
            // Location
            const location = $row.find("span.jobLocation.visible-phone").text().trim();
            // Closing date
            const closingDate = $row.find("span.jobDate.visible-phone").text().trim();
            // Department (since the filter is for cyber, we can hardcode)
            const department = "Cyber Security & Digital Solutions";

            if (title && link) {
                jobs.push({
                    title,
                    link,
                    department,
                    location,
                    closingDate
                });
                console.log(`Found NS job:`, { title, link, department, location, closingDate });
            }
        });

        console.log(`Found ${jobs.length} Nova Scotia government jobs on the website`);
        return jobs;
    } catch (error) {
        console.error("Error scraping Nova Scotia jobs:", error);
        return [];
    }
}

function loadPreviousNSJobs() {
    if (fs.existsSync(NS_JOBS_FILE)) {
        console.log("Loading previous Nova Scotia jobs from", NS_JOBS_FILE);
        const jobs = JSON.parse(fs.readFileSync(NS_JOBS_FILE));
        console.log(`Loaded ${jobs.length} previous Nova Scotia jobs`);
        return jobs;
    }
    console.log("No previous Nova Scotia jobs file found");
    return [];
}

function saveNSJobs(jobs) {
    fs.writeFileSync(NS_JOBS_FILE, JSON.stringify(jobs, null, 2));
}

async function checkForNewNSJobs() {
    const currentJobs = await scrapeNSJobs();
    const previousJobs = loadPreviousNSJobs();
    
    // Reverse the order so new jobs appear at the bottom
    currentJobs.reverse();
    
    console.log("\nComparing Nova Scotia jobs:");
    console.log(`Current jobs: ${currentJobs.length}`);
    console.log(`Previous jobs: ${previousJobs.length}`);
    
    const newJobs = currentJobs.filter(job => 
        !previousJobs.some(prev => prev.link === job.link)
    );
    
    if (newJobs.length > 0) {
        console.log("New Nova Scotia government jobs found:");
        newJobs.forEach(job => {
            console.log(`- ${job.title} (${job.department})`);
        });

        saveNSJobs(currentJobs);
        console.log(`\nSaved ${currentJobs.length} Nova Scotia jobs to ${NS_JOBS_FILE}`);
        
        // Send new jobs to Discord webhook
        if (process.env.NS_JOBS_WEBHOOK_URL) {
            try {
                console.log("\nSending to Discord webhook...");
                
                const chunkSize = 10;
                for (let i = 0; i < newJobs.length; i += chunkSize) {
                    const chunk = newJobs.slice(i, i + chunkSize);
                    const discordMessage = {
                        embeds: chunk.map(job => ({
                            title: job.title,
                            url: job.link,
                            color: 0x00ff00, // Green color for jobs
                            description: `**Department:** ${job.department}\n**Location:** ${job.location}\n**Closing Date:** ${job.closingDate}`,
                            footer: {
                                text: `Nova Scotia Government Jobs - Cyber Department (${i + 1}-${Math.min(i + chunkSize, newJobs.length)} of ${newJobs.length})`
                            }
                        }))
                    };

                    const response = await axios.post(process.env.NS_JOBS_WEBHOOK_URL, discordMessage);
                    if (response.status === 204) {
                        console.log(`Successfully posted chunk ${Math.floor(i/chunkSize) + 1} to Discord`);
                    }
                    
                    if (i + chunkSize < newJobs.length) {
                        await new Promise(resolve => setTimeout(resolve, 1000));
                    }
                }
            } catch (error) {
                console.error('Error posting to Discord:', error.response?.data || error.message);
            }
        } else {
            console.error("NS_JOBS_WEBHOOK_URL not defined in .env");
        }
    } else {
        console.log("No new Nova Scotia government jobs found. All jobs are already in our database.");
    }
}

// Test function for Discord webhook
async function testNSDiscordWebhook() {
    if (!process.env.NS_JOBS_WEBHOOK_URL) {
        console.error("NS_JOBS_WEBHOOK_URL not defined in .env");
        return;
    }

    const testJob = {
        title: "Test Cyber Security Position",
        link: "https://jobs.novascotia.ca/go/All-Opportunities/502817/",
        department: "Cyber Security",
        location: "Halifax",
        closingDate: "December 31, 2024"
    };

    try {
        const discordMessage = {
            embeds: [{
                title: testJob.title,
                url: testJob.link,
                color: 0x00ff00, // Green color for jobs
                description: `**Department:** ${testJob.department}\n**Location:** ${testJob.location}\n**Closing Date:** ${testJob.closingDate}`,
                footer: {
                    text: "Test Message - Nova Scotia Government Jobs"
                }
            }]
        };

        const response = await axios.post(process.env.NS_JOBS_WEBHOOK_URL, discordMessage);
        if (response.status === 204) {
            console.log('Successfully sent test message to Discord');
        }
    } catch (error) {
        console.error('Error sending test message to Discord:', error.response?.data || error.message);
    }
}

// Run the main function
checkForNewNSJobs();
// Uncomment to test Discord webhook
 //testNSDiscordWebhook(); 