💾 Editable Card System (Local CRUD & JSON Data Management): 
A client-side CRUD (Create, Read, Update, Delete) application for managing, visualizing, and exporting data records, designed to operate fully in constrained environments using only HTML, CSS, and pure JavaScript.

🖼️ Key Features Showcase: 
(Note: Ideally, you would add a GIF or screenshot here showing the creation or editing of a card, and the stylish, modern CSS.)
The system provides a modern, intuitive card interface, allowing for seamless data management and direct export capabilities.

📄 About The Project: 
This project solves the crucial need for local data persistence and management where database or server installations are impossible. It functions as a complete, self-contained data-entry and reporting tool.
The solution leverages JavaScript's local capabilities to handle all CRUD operations, exporting the data state as a JSON file, and then reloading it upon execution.

Core Data Flow: 
Read (Import): Upon loading, the system reads the data directly from a designated JSON file, populating the card interface.
CRUD Operations: All creation, reading, updating, and deletion are handled immediately in the browser's JavaScript memory.
Export (Persistence): Users can explicitly export the current state of the data as a clean JSON file, saving changes for the next session.

Key Features: 
➕ Data Creation: Easily create new data records (cards) via an input form.
✏️ Edit and Update: Modify existing card information directly through the interface.
🗑️ Data Deletion: Remove records instantly.
📦 JSON Export: Export the entire current dataset to a JSON file, providing robust local data persistence without a database.
🔍 Search/Filter: Functionality to quickly locate specific records.
🎨 Modern UI: Features professional, modern CSS for an enhanced user experience and clarity.

💻 Technologies Used: 
This project showcases mastery of core front-end languages and local data management:
HTML5: Structure for the cards and data entry forms.
CSS3 (Modern): Used for professional styling, ensuring a clean, modern, and high-quality UI (using techniques like Flexbox or Grid).
JavaScript (Vanilla): Implements all CRUD logic, DOM manipulation, and handles the logic for exporting and importing the JSON file.
JSON: Used as the primary data storage format for local persistence.

⚙️ How To Run The Project Locally: 
Since this is a client-side application, it is incredibly easy to set up:

1. Clone the repository: git clone https://github.com/felipe-feEee/Portifolio.git
cd Portifolio/[NOME_DA_PASTA_CRUD]

2. Open the Application:
Simply open the main HTML file (e.g., index.html) in your browser.

3. Data Persistence:
The system will attempt to read from the local JSON file. After making changes, use the Export function to save the updated data locally, ready for the next time you open the file.

🧠 Challenges and Key Takeaways: 
Simulating a Database: Successfully implementing the full CRUD cycle using only JavaScript memory and the JSON export mechanism, effectively simulating database persistence in a browser-only environment.
JSON Export Handling: Developing reliable JavaScript functions to trigger local file downloads (JSON export) and handle file input (JSON import) safely and efficiently.

Maintainability: Structuring the JavaScript code (e.g., using modular functions or an OOP approach) to manage the complex state of the cards (create, edit, delete) clearly and maintainably.
✒️ Author
Felipe Costa
