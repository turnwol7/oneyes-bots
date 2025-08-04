require("dotenv").config();
const axios = require("axios");
const fs = require("fs");
const cheerio = require("cheerio");

const CITY = "halifax";
const JOBS_URL = "https://digitalnovascotia.com/job-posts/";
const JOBS_FILE = `./data/${CITY}/${CITY}-dns-jobs.json`;

process.on('unhandledRejection', (error) => {
    console.error('Unhandled promise rejection:', error);
    process.exit(1);
});

async function scrapeJobs() {
    try {
        console.log("Fetching jobs from:", JOBS_URL);
        
        // Enhanced headers to avoid 403 error
        const { data } = await axios.get(JOBS_URL, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.9',
                'Accept-Encoding': 'gzip, deflate, br',
                'DNT': '1',
                'Connection': 'keep-alive',
                'Upgrade-Insecure-Requests': '1',
                'Sec-Fetch-Dest': 'document',
                'Sec-Fetch-Mode': 'navigate',
                'Sec-Fetch-Site': 'none',
                'Sec-Fetch-User': '?1',
                'Cache-Control': 'max-age=0'
            },
            timeout: 10000,
            maxRedirects: 5
        });
        
        const $ = cheerio.load(data);
        let jobs = [];

        // Correct selector based on the actual HTML structure
        $("a.job-listing").each((i, el) => {
            const $el = $(el);
            
            // Job title (in h3 inside .business-info)
            const title = $el.find(".business-info h3").text().trim();
            
            // Job link (the href of the a.job-listing element)
            const link = $el.attr("href");
            
            // Company name (in h4 inside .business-info)
            const company = $el.find(".business-info h4").text().trim();
            
            // Location (in h4 inside .job-region)
            const location = $el.find(".job-region h4").text().trim();
            
            // Job type (in .job-type span)
            const jobType = $el.find(".job-info .job-type").text().trim();
            
            // Posted date (in .date span)
            const postedDate = $el.find(".job-info .date").text().trim();
            
            console.log(`Found job ${i + 1}:`, { title, company, location, jobType, postedDate });
            
            if (title && link) {
                // Make sure link is absolute
                const fullLink = link.startsWith('http') ? link : `https://digitalnovascotia.com${link}`;
                jobs.push({ 
                    title, 
                    link: fullLink,
                    company,
                    location,
                    jobType,
                    postedDate
                });
            }
        });

        console.log(`Found ${jobs.length} jobs on the website`);
        return jobs;
    } catch (error) {
        console.error("Error scraping jobs:", error.response?.status, error.response?.statusText);
        
        // If we still get 403, try with a different approach
        if (error.response?.status === 403) {
            console.log("403 error detected. Trying alternative approach...");
            return await scrapeJobsAlternative();
        }
        
        return [];
    }
}

// Alternative scraping method if the main one fails
async function scrapeJobsAlternative() {
    try {
        console.log("Trying alternative scraping method...");
        
        // Try with different headers
        const { data } = await axios.get(JOBS_URL, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.5',
                'Accept-Encoding': 'gzip, deflate',
                'Connection': 'keep-alive',
                'Upgrade-Insecure-Requests': '1'
            },
            timeout: 15000
        });
        
        const $ = cheerio.load(data);
        let jobs = [];

        $("a.job-listing").each((i, el) => {
            const $el = $(el);
            
            const title = $el.find(".business-info h3").text().trim();
            const link = $el.attr("href");
            const company = $el.find(".business-info h4").text().trim();
            const location = $el.find(".job-region h4").text().trim();
            const jobType = $el.find(".job-info .job-type").text().trim();
            const postedDate = $el.find(".job-info .date").text().trim();
            
            if (title && link) {
                const fullLink = link.startsWith('http') ? link : `https://digitalnovascotia.com${link}`;
                jobs.push({ 
                    title, 
                    link: fullLink,
                    company,
                    location,
                    jobType,
                    postedDate
                });
            }
        });

        console.log(`Alternative method found ${jobs.length} jobs`);
        return jobs;
    } catch (error) {
        console.error("Alternative method also failed:", error.response?.status);
        return [];
    }
}

function loadPreviousJobs() {
    if (fs.existsSync(JOBS_FILE)) {
        try {
            console.log("Loading previous jobs from", JOBS_FILE);
            const jobs = JSON.parse(fs.readFileSync(JOBS_FILE));
            console.log(`Loaded ${jobs.length} previous jobs`);
            return jobs;
        } catch (error) {
            console.error("Error loading previous jobs:", error);
            return [];
        }
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
    
    console.log("\nComparing jobs:");
    console.log(`Current jobs: ${currentJobs.length}`);
    console.log(`Previous jobs: ${previousJobs.length}`);
    
    // Use both title and company for comparison to be more accurate
    const newJobs = currentJobs.filter(currentJob => 
        !previousJobs.some(prevJob => 
            prevJob.title === currentJob.title && 
            prevJob.company === currentJob.company
        )
    );
    
    if (newJobs.length > 0) {
        console.log("New jobs found:");
        newJobs.forEach(job => {
            console.log(`- ${job.title} (${job.company})`);
        });

        saveJobs(currentJobs);
        console.log(`\nSaved ${currentJobs.length} jobs to ${JOBS_FILE}`);
        
        // Send new jobs to Discord
        const webhookUrl = process.env.HALIFAX_JOBS_WEBHOOK_URL;
        if (webhookUrl) {
            try {
                console.log("\nSending to Discord webhook...");
                
                const chunkSize = 10;
                // Send jobs in reverse order so newest appear at bottom
                const reversedNewJobs = [...newJobs].reverse();
                
                for (let i = 0; i < reversedNewJobs.length; i += chunkSize) {
                    const chunk = reversedNewJobs.slice(i, i + chunkSize);
                    const discordMessage = {
                        embeds: chunk.map(job => ({
                            title: job.title,
                            url: job.link,
                            color: 0x0066cc, // Ocean blue color
                            description: `**Company:** ${job.company}\n**Location:** ${job.location}\n**Type:** ${job.jobType}\n**Posted:** ${job.postedDate}`,
                            footer: {
                                text: `Halifax Jobs - Digital Nova Scotia (${i + 1}-${Math.min(i + chunkSize, reversedNewJobs.length)} of ${reversedNewJobs.length})`
                            }
                        }))
                    };

                    const response = await axios.post(webhookUrl, discordMessage);
                    if (response.status === 204) {
                        console.log(`Successfully posted chunk ${Math.floor(i/chunkSize) + 1} to Discord`);
                    }
                    
                    if (i + chunkSize < reversedNewJobs.length) {
                        await new Promise(resolve => setTimeout(resolve, 1000));
                    }
                }
            } catch (error) {
                console.error('Error posting to Discord:', error.response?.data || error.message);
            }
        } else {
            console.error("HALIFAX_JOBS_WEBHOOK_URL not defined in .env");
        }
    } else {
        console.log("No new jobs found. All jobs are already in our database.");
    }
}

// Run the scraper
checkForNewJobs();
