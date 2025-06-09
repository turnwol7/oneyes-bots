require("dotenv").config();
const axios = require("axios");
const fs = require("fs");
const cheerio = require("cheerio");

const JOBS_URL = "https://digitalnovascotia.com/job-posts/";
const JOBS_FILE = "jobs.json";

process.on('unhandledRejection', (error) => {
    console.error('Unhandled promise rejection:', error);
    process.exit(1);
});

async function scrapeJobs() {
    try {
        console.log("Fetching jobs from:", JOBS_URL);
        const { data } = await axios.get(JOBS_URL);
        const $ = cheerio.load(data);
        let jobs = [];

        // Updated selector to match the actual HTML structure
        $(".job-listing").each((i, el) => {
            const title = $(el).find("h3").text().trim();
            const link = $(el).attr("href");
            const company = $(el).find(".business-info h4").text().trim();
            const location = $(el).find(".job-region h4").text().trim();
            const jobType = $(el).find(".job-type").text().trim();
            
            console.log(`Found job ${i + 1}:`, { title, company, location, jobType });
            
            if (title && link) {
                jobs.push({ 
                    title, 
                    link,
                    company,
                    location,
                    jobType
                });
            }
        });

        console.log(`Found ${jobs.length} jobs on the website`);
        return jobs;
    } catch (error) {
        console.error("Error scraping jobs:", error);
        return [];
    }
}

function loadPreviousJobs() {
    if (fs.existsSync(JOBS_FILE)) {
        console.log("Loading previous jobs from", JOBS_FILE);
        const jobs = JSON.parse(fs.readFileSync(JOBS_FILE));
        console.log(`Loaded ${jobs.length} previous jobs`);
        return jobs;
    }
    console.log("No previous jobs file found");
    return [];
}

function saveJobs(jobs) {
    fs.writeFileSync(JOBS_FILE, JSON.stringify(jobs, null, 2));
}

async function checkForNewJobs() {
    const currentJobs = await scrapeJobs();
    const previousJobs = loadPreviousJobs();
    
    // Reverse the order so new jobs appear at the bottom
    currentJobs.reverse();
    
    console.log("\nComparing jobs:");
    console.log(`Current jobs: ${currentJobs.length}`);
    console.log(`Previous jobs: ${previousJobs.length}`);
    
    const newJobs = currentJobs.filter(job => !previousJobs.some(prev => prev.link === job.link));
    
    console.log("\nJob comparison details:");
    if (newJobs.length > 0) {
        console.log("New jobs found:");
        newJobs.forEach(job => {
            console.log(`- ${job.title} (${job.company})`);
        });

        saveJobs(currentJobs);
        console.log(`\nSaved ${currentJobs.length} jobs to ${JOBS_FILE}`);
        
        // Send new jobs to Discord webhook
        if (process.env.JOBS_WEBHOOK_URL) {
            try {
                console.log("\nSending to Discord webhook...");
                
                // Split jobs into chunks of 10 for the initial run
                const chunkSize = 10;
                for (let i = 0; i < newJobs.length; i += chunkSize) {
                    const chunk = newJobs.slice(i, i + chunkSize);
                    const discordMessage = {
                        embeds: chunk.map(job => ({
                            title: job.title,
                            url: job.link,
                            color: 0x00ff00, 
                            description: `**Company:** ${job.company}\n**Location:** ${job.location}\n**Type:** ${job.jobType}`,
                            footer: {
                                text: `Digital Nova Scotia Jobs (${i + 1}-${Math.min(i + chunkSize, newJobs.length)} of ${newJobs.length})`
                            }
                        }))
                    };

                    const response = await axios.post(process.env.JOBS_WEBHOOK_URL, discordMessage);
                    if (response.status === 204) {
                        console.log(`Successfully posted chunk ${Math.floor(i/chunkSize) + 1} to Discord`);
                    }
                    
                    // Add a small delay between messages to avoid rate limiting
                    if (i + chunkSize < newJobs.length) {
                        await new Promise(resolve => setTimeout(resolve, 1000));
                    }
                }
            } catch (error) {
                console.error('Error posting to Discord:', error.response?.data || error.message);
            }
        } else {
            console.error("JOBS_WEBHOOK_URL not defined in .env");
        }
    } else {
        console.log("No new jobs found. All jobs are already in our database.");
    }
}

async function testDiscordWebhook() {
    if (!process.env.JOBS_WEBHOOK_URL) {
        console.error("JOBS_WEBHOOK_URL not defined in .env");
        return;
    }

    const testJob = {
        title: "Test Job Posting",
        link: "https://digitalnovascotia.com/job-posts/",
        company: "Test Company",
        location: "Halifax",
        jobType: "Full Time"
    };

    try {
        const discordMessage = {
            embeds: [{
                title: testJob.title,
                url: testJob.link,
                color: 0x00ff00,
                description: `**Company:** ${testJob.company}\n**Location:** ${testJob.location}\n**Type:** ${testJob.jobType}`,
                footer: {
                    text: "Test Message - Digital Nova Scotia Jobs"
                }
            }]
        };

        const response = await axios.post(process.env.JOBS_WEBHOOK_URL, discordMessage);
        if (response.status === 204) {
            console.log('Successfully sent test message to Discord');
        }
    } catch (error) {
        console.error('Error sending test message to Discord:', error.response?.data || error.message);
    }
}

checkForNewJobs();
// testDiscordWebhook();
