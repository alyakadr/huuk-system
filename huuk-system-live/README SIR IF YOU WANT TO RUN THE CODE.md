# HUUK System – How to Run

## 1. Install Requirements

- Install **Node.js** (from https://nodejs.org)
- Install **MySQL** (from https://www.mysql.com)

---

## 2. Set Up the Database

1. Open MySQL (e.g., MySQL Workbench or command line).
2. Create a new database, for example:  
   ```sql
   CREATE DATABASE huuk_db;
   ```
3. Run the SQL files in `server/migrations/` to create the tables.  
   Example command (in terminal, from your project root):
   ```sh
   mysql -u your_mysql_username -p huuk_db < server/migrations/create_slot_reservations.sql
   ```
   *(Repeat for other `.sql` files in that folder if needed)*

---

## 3. Install Project Dependencies

Open two terminals:

- **Terminal 1:**  
  Go to the `client` folder and run:
  ```sh
  cd client
  npm install
  ```

- **Terminal 2:**  
  Go to the `server` folder and run:
  ```sh
  cd server
  npm install
  ```

---

## 4. Start the Project

- In the `server` folder, run:
  ```sh
  npm start
  ```
- In the `client` folder, run:
  ```sh
  npm start
  ```

---

## 5. Open the App

- Open your browser and go to:  
  [http://localhost:3000](http://localhost:3000)

---

**Done!**  
If you want to see the live version, go to your provided domain.
