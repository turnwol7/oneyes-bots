require("dotenv").config();
const axios = require("axios");
const fs = require("fs");
const cheerio = require("cheerio");

const CITY = "toronto";
const TECHTO_JOBS_URL = "https://jobs.techto.org/jobs?q=&category=product-engineering&job_type=&posted_at=&location=Toronto%2C+Ontario%2C+Canada&location_id=1233&search_radius=&order=relevance";
const TECHTO_JOBS_FILE = `./data/${CITY}/${CITY}-techto-jobs.json`; // Updated path

process.on('unhandledRejection', (error) => {
    console.error('Unhandled promise rejection:', error);
    process.exit(1);
});

async function scrapeTechTOJobs() {
    try {
        console.log("Fetching TechTO jobs from:", TECHTO_JOBS_URL);
        const { data } = await axios.get(TECHTO_JOBS_URL);
        const $ = cheerio.load(data);
        let jobs = [];

        // Select job listings from the page
        $(".job-listings-item").each((i, el) => {
            const $job = $(el);
            
            // Job title and link
            const title = $job.find("h3").text().trim();
            const link = $job.find("a.job-details-link").attr("href");
            const fullLink = link ? `https://jobs.techto.org${link}` : null;
            
            // Company name
            const company = $job.find("a[href*='/companies/']").text().trim();
            
            // Job type (Full-time, Part-time, etc.)
            const jobType = $job.find("a[href*='/jobs/full-time'], a[href*='/jobs/part-time'], a[href*='/jobs/contract']").text().trim();
            
            // Location
            const location = $job.find("span:contains('Remote'), span:contains('Toronto')").text().trim();
            
            // Posted date
            const postedDate = $job.find(".job-posted-date").text().trim();
            
            // Job tags/categories
            const tags = [];
            $job.find(".job-tag").each((j, tag) => {
                tags.push($(tag).text().trim());
            });

            if (title && fullLink) {
                jobs.push({
                    title,
                    link: fullLink,
                    company,
                    jobType,
                    location,
                    postedDate,
                    tags: tags.join(", ")
                });
                console.log(`Found TechTO job:`, { title, company, jobType, location, postedDate });
            }
        });

        console.log(`Found ${jobs.length} TechTO jobs on the website`);
        return jobs;
    } catch (error) {
        console.error("Error scraping TechTO jobs:", error);
        return [];
    }
}

function loadPreviousTechTOJobs() {
    if (fs.existsSync(TECHTO_JOBS_FILE)) {
        try {
            const fileContent = fs.readFileSync(TECHTO_JOBS_FILE, 'utf8');
            if (fileContent.trim() === '') {
                console.log("File is empty, starting fresh");
                return [];
            }
            const jobs = JSON.parse(fileContent);
            console.log(`Loaded ${jobs.length} previous TechTO jobs`);
            return jobs;
        } catch (error) {
            console.log("Error reading file, starting fresh:", error.message);
            return [];
        }
    }
    console.log("No previous TechTO jobs file found");
    return [];
}

function saveTechTOJobs(jobs) {
    fs.writeFileSync(TECHTO_JOBS_FILE, JSON.stringify(jobs, null, 2));
}

async function checkForNewTechTOJobs() {
    const currentJobs = await scrapeTechTOJobs();
    const previousJobs = loadPreviousTechTOJobs();
    
    // Reverse the order so new jobs appear at the bottom
    currentJobs.reverse();
    
    console.log("\nComparing TechTO jobs:");
    console.log(`Current jobs: ${currentJobs.length}`);
    console.log(`Previous jobs: ${previousJobs.length}`);
    
    const newJobs = currentJobs.filter(job => 
        !previousJobs.some(prev => prev.link === job.link)
    );
    
    if (newJobs.length > 0) {
        console.log("New TechTO jobs found:");
        newJobs.forEach(job => {
            console.log(`- ${job.title} (${job.company})`);
        });

        saveTechTOJobs(currentJobs);
        console.log(`\nSaved ${currentJobs.length} TechTO jobs to ${TECHTO_JOBS_FILE}`);
        
        // Send new jobs to consolidated Toronto jobs webhook
        const webhookUrl = process.env.TORONTO_JOBS_WEBHOOK_URL;
        if (webhookUrl) {
            try {
                console.log("\nSending to Discord webhook...");
                
                const chunkSize = 10;
                for (let i = 0; i < newJobs.length; i += chunkSize) {
                    const chunk = newJobs.slice(i, i + chunkSize);
                    const discordMessage = {
                        embeds: chunk.map(job => ({
                            title: job.title,
                            url: job.link,
                            color: 0xf7931a, // Bitcoin orange color for Toronto jobs
                            description: `**Company:** ${job.company}\n**Type:** ${job.jobType}\n**Location:** ${job.location}\n**Posted:** ${job.postedDate}${job.tags ? `\n**Tags:** ${job.tags}` : ''}`,
                            footer: {
                                text: `Toronto Jobs - TechTO (${i + 1}-${Math.min(i + chunkSize, newJobs.length)} of ${newJobs.length})`
                            }
                        }))
                    };

                    const response = await axios.post(webhookUrl, discordMessage);
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
            console.error("TORONTO_JOBS_WEBHOOK_URL not defined in .env");
        }
    } else {
        console.log("No new TechTO jobs found. All jobs are already in our database.");
    }
}

// Test function for Discord webhook
async function testTechTODiscordWebhook() {
    if (!process.env.TORONTO_JOBS_WEBHOOK_URL) {
        console.error("TORONTO_JOBS_WEBHOOK_URL not defined in .env");
        return;
    }

    const testJob = {
        title: "Test Toronto Tech Position",
        link: "https://jobs.techto.org/jobs/",
        company: "Test Company",
        jobType: "Full-time",
        location: "Toronto, ON",
        postedDate: "2d ago",
        tags: "Product & Engineering"
    };

    try {
        const discordMessage = {
            embeds: [{
                title: testJob.title,
                url: testJob.link,
                color: 0xf7931a, // Bitcoin orange color
                description: `**Company:** ${testJob.company}\n**Type:** ${testJob.jobType}\n**Location:** ${testJob.location}\n**Posted:** ${testJob.postedDate}\n**Tags:** ${testJob.tags}`,
                footer: {
                    text: "Test Message - Toronto TechTO Jobs"
                }
            }]
        };

        const response = await axios.post(process.env.TORONTO_JOBS_WEBHOOK_URL, discordMessage);
        if (response.status === 204) {
            console.log('Successfully sent test message to Discord');
        }
    } catch (error) {
        console.error('Error sending test message to Discord:', error.response?.data || error.message);
    }
}

// Run the main function
checkForNewTechTOJobs();
// Uncomment to test Discord webhook
// testTechTODiscordWebhook(); 