# 📄 Intelligent PDF to Excel Data Mapper

An advanced Angular application designed to automate data entry workflows. This tool extracts data from **text-based PDF documents** and intelligently maps them to structured Excel headers using fuzzy logic and heuristic algorithms.

> **Note:** This version currently supports **selectable text PDFs only**. Scanned images or handwritten documents are not supported.

## 🚀 Key Features

* **Smart Data Mapping:** Implements a custom scoring algorithm combining **Levenshtein Distance** and **Jaccard Similarity** to match PDF contents with Excel headers even when spelling varies.

* **Dynamic Template Support:** Users can upload any CSV or Excel file to define the output structure.

* **Key-Value Pair Extraction:** Uses Regular Expressions (Regex) to detect `Key: Value` patterns within unstructured text.

* **Client-Side Processing:** All processing happens in the browser, ensuring data privacy and speed.

* **Excel Export:** Generates and downloads a fully populated `.xlsx` file using `SheetJS`.



## ⚠️ Limitations

* **No OCR Support:** The application **cannot read scanned PDFs** or images. The PDF must have selectable text.



## 🛠️ Tech Stack

* **Framework:** Angular (TypeScript)

* **PDF Processing:** PDF.js

* **Spreadsheet Handling:** SheetJS (xlsx), PapaParse

* **Algorithms:** Fuzzy Logic (String Similarity), Regex Pattern Matching



## 🧠 How It Works (The Algorithm)

1.  **Ingestion:** The app accepts a digital PDF (text-based) and a target Excel template.

2.  **Extraction:** It reads the raw text layers from the PDF using `pdf.js`.

3.  **Normalization:** Text is cleaned, normalized, and tokenized to remove noise.

4.  **Mapping Logic:**

    * The system scans for "Header-like" keys in the PDF.

    * It compares these keys against the uploaded Excel headers using a weighted scoring system:

        * *Exact Match:* 65% weight

        * *Partial Match:* 25% weight

        * *Jaccard Similarity:* 60% weight

        * *Levenshtein Distance:* 35% weight

5.  **Output:** The highest-scoring matches are paired, and a new Excel file is generated.



## 📦 Installation

1.  **Clone the repository**

    ```bash

    git clone [https://github.com/Rivin2001/pdf-data-mapper.git](https://github.com/Rivin2001/pdf-data-mapper.git)

    cd pdf-data-mapper

    ```



2.  **Install Dependencies**

    ```bash

    npm install

    ```



3.  **Run the Application**

    ```bash

    ng serve

    ```

    Navigate to `http://localhost:4200/`.



## 📖 Usage Guide

1.  Click **"Select PDF"** to upload the source document (Must be a text-based PDF).

2.  Click **"Select Excel/CSV"** to upload the template containing the headers you need.

3.  The system will automatically map the data.

4.  Review the mappings in the preview table.

5.  Click **"Download Excel"** to get your result.



## 🤝 Contributing

Contributions, issues, and feature requests are welcome! Feel free to check the [issues page](https://github.com/Rivin2001/pdf-data-mapper/issues).



## 📝 License
This project is licensed under the MIT License.
