🚀 NF-e XML Data Management & Visualization System (Pure HTML/JS): 
A robust Front-end and Automation (PowerShell) Solution designed to scan, process, and display Electronic Invoice (NF-e) data in constrained environments without an HTTP server.

🖼️ Visual Demonstration: 
(Note: You can add an image or a recorded GIF here to showcase the modern, clean interface and the search functionality.)
The modern and responsive interface facilitates the location of specific invoices within a repository containing thousands of files.
Video Demo (Functionality and UI): Watch the XML System Functionality

📄 About The Project: 
The NF-e Visualization System addresses the challenge of accessing and managing invoice data stored on a network drive where installing tools like Node.js or HTTP servers is prohibited.
This project strongly showcases proficiency in Pure JavaScript Client-Side Development and Operating System Automation via PowerShell.
Workflow and Solution Engineering
Data Extraction (PowerShell #1): A PowerShell script scans a designated network folder, identifying valid NF-e XML files. It extracts critical metadata (Number, Series, Access Key, Path, and Modification Date) and generates a data.json file.
Front-end Preparation (PowerShell #2): A second PowerShell script concatenates the JSON data file directly with the application's JavaScript code. This technique ensures that the data is read instantly by the browser, bypassing the need for HTTP requests (fetch or XMLHttpRequest).
Visualization (HTML/CSS/JS): The main HTML page loads the self-contained JavaScript/Data bundle, rendering the interface with listing, search, and filter capabilities.

Key Features: 
🔍 Instant Search: Filters the NF-e list by number, series, or access key in real-time.
📜 Metadata Display: Shows the Number, Series, Modification Date, and Access Key for each invoice.
📂 Direct Access: Functionality to Open XML and Copy Path/Access Key directly from the UI.
🎨 Professional Design: Interface developed with modern, professional CSS, ensuring a clean and efficient user experience.

💻 Technologies Used: 
This solution highlights the integration of automation scripts with client-side development:
PowerShell: Used for file scanning automation, XML parsing, and data-binding (JSON/JS concatenation).
JavaScript (Vanilla): Core logic for search, filter, and DOM manipulation to render the list.
HTML5 & CSS3: User interface structure and styling, focused on performance and professional design.

⚙️ How To Run The Project Locally: 
Execution involves an automation step (PowerShell) followed by opening the HTML file:
Step 1: Environment Setup
Clone the repository.
Edit the main PowerShell script to define the Network Path (XML Folder) you wish to scan.
Step 2: Run Automation
Execute the included .bat file (or schedule it via Task Scheduler).
The .bat file triggers the two PowerShell scripts:
Script #1 generates the raw data.json from the NF-e files.
Script #2 concatenates the JSON with the JavaScript, creating the final visualization file.
Step 3: System Visualization
Simply open the main HTML file (e.g., index.html) in your browser.
The system will instantly load the pre-processed data and be ready for searching and use.

🧠 Challenges and Key Takeaways: 
Server Limitation Bypass: Overcame the restriction of no HTTP server by engineering a PowerShell solution for data-binding, loading data directly into the JavaScript environment.
PowerShell Optimization: Developed efficient scripts to handle a large volume of XML files (over 50,000+), ensuring fast and reliable metadata extraction.
Front-end Performance: Ensured that search and rendering operations remain instantaneous, even with thousands of records loaded in the browser, demonstrating high-performance JavaScript skills.

✒️ Author: 
Felipe Costa