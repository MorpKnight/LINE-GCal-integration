// auth.js
const fs = require('fs').promises;
const path = require('path');
const { authenticate } = require('@google-cloud/local-auth');
const { google } = require('googleapis');
const { auth } = require('googleapis/build/src/apis/abusiveexperiencereport');

const SCOPES = ['https://www.googleapis.com/auth/tasks.readonly', 'https://www.googleapis.com/auth/tasks'];
const TOKEN_PATH = path.join(process.cwd(), 'token.json');
// const CREDENTIALS_PATH = path.join(process.cwd(), 'credentials.json');


/**
 * Loads saved credentials if they exist.
 * 
 * @returns {Promise<google.auth.GoogleAuth|null>} A promise that resolves to a GoogleAuth object if credentials exist, or null if they don't.
 */
async function loadSavedCredentialsIfExist() {
    try {
        // const content = await fs.readFile(TOKEN_PATH);
        const content = process.env.TOKEN
        const credentials = JSON.parse(content);
        return google.auth.fromJSON(credentials);
    } catch (err) {
        return null;
    }
}


/**
 * Saves the credentials for the client.
 * 
 * @param {object} client - The client object.
 * @returns {Promise<void>} - A promise that resolves when the credentials are saved.
 */
async function saveCredentials(client) {
    const content = {
        installed: {
            client_id: process.env.CLIENT_ID,
            project_id: process.env.PROJECT_ID,
            auth_uri: "https://accounts.google.com/o/oauth2/auth",
            token_uri: "https://oauth2.googleapis.com/token",
            auth_provider_x509_cert_url: "https://www.googleapis.com/oauth2/v1/certs",
            client_secret: process.env.CLIENT_SECRET,
            redirect_uris: ["http://localhost"],
        }
    };
    
    const contentString = JSON.stringify(content);
    
    const keys = JSON.parse(contentString);
    
    const key = keys.installed || keys.web;
    const payload = JSON.stringify({
        type: 'authorized_user',
        client_id: key.client_id,
        client_secret: key.client_secret,
        refresh_token: client.credentials.refresh_token,
    });
    await fs.writeFile(TOKEN_PATH, payload);
}


/**
 * Authorizes the client by loading saved credentials if they exist,
 * otherwise authenticates the client with the specified scopes and key file path.
 * If the client's credentials are obtained, they are saved for future use.
 * @returns {Promise<Client>} A promise that resolves to the authorized client.
 */
async function authorize() {
    let client = await loadSavedCredentialsIfExist();
    if (client) {
        return client;
    }
    // client = await authenticate({
    //     scopes: SCOPES,
    //     keyfilePath: CREDENTIALS_PATH,
    // });
    if (client.credentials) {
        await saveCredentials(client);
    }
    return client;
}

module.exports = {
    authorize
};
