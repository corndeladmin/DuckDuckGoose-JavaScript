# DuckDuckGoose

1. Fork this repo: click `Fork` in the top-right of the page - this will create a copy of this repo in **your own GitHub account**

1. Clone (download) the repo
    * Go to your newly-created fork of the repo (on GitHub).
    * Click `Clone or download` (the green button on the right).
    * Make sure the page says `Clone with SSH` (rather than `Clone with HTTPS`).
    * Open your git client (e.g. GitKraken) and use this link to clone the repo.  
      Your trainer will be able to help you with this.

1. "Cloning the repo" will create a folder on your computer with the files from this repo.  
   Open this folder in  Visual Studio Code.

1. Make sure you've got PostgreSQL and pgAdmin installed. You'll need to set up a user and a database for this project.
   All instructions for this step are in the `Setting up Postgres` section below.

1. Open a command-prompt in this same folder.  
   Your trainer can show you how to do this, if you need any help.

1. Install the dependencies:
`npm install`

1. Build the app:
`npm run build`

1.  Run the app:
`npm run start`

1. The app should now be available at https://localhost:3000

## Setting up PostgreSQL

Before you run the app you will need to make sure you've got PostgreSQL installed and a database set up.

### Installing PostgreSQL and pgAdmin

1. Download and install the [PostgreSQL server software](https://www.enterprisedb.com/downloads/postgres-postgresql-downloads) if you haven't already.

1. Open the Windows Start menu and search for "pgAdmin". When you start "pgAdmin" for the first time, you'll be asked to set a master password.

### Set up the DuckDuckGoose user

1. Inside your PostgreSQL server in pgAdmin, right-click on *Login/Group Roles* and create a new Login/Group Role with the name `duckduckgoose` (in the *General* tab), the password `duckduckgoose` (in the *Definition* tab) and the ability to log in and create databases (in the *Privileges* tab).

1. Click Save to create the user.

### Set up DuckDuckGoose database

1. Inside your PostgreSQL server in pgAdmin, right-click on *Databases* and create a new Database with the name `duckduckgoose` and the owner `duckduckgoose` (both in the *General* tab).

1. Click Save to create the database.
