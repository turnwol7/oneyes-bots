# Nova Scotia Tech Job Scraper Bot

A GitHub Actions bot that monitors Digital Nova Scotia's job board and posts new job listings to a Discord channel.

## Features

- Scrapes job listings from digitalnovascotia.com
- Posts new jobs to Discord with detailed information
- Runs automatically every hour via GitHub Actions
- Tracks previously posted jobs to avoid duplicates

## To modify this to a new job board

1. Fork this repository
2. Create a Discord webhook in your server
3. Add the webhook URL as a GitHub Secret named `WEBHOOK_URL`
4. Enable GitHub Actions in your fork

## Contributing

Feel free to submit issues and enhancement requests!

## License

MIT License - feel free to use this code for your own projects.  
