const fs = require('fs').promises;
const path = require('path');
const { google } = require('googleapis');

const SCOPES = ['https://www.googleapis.com/auth/tasks.readonly', 'https://www.googleapis.com/auth/tasks'];
const TOKEN_PATH = path.join(process.cwd(), 'token.json');

async function loadSavedCredentialsIfExist() {
    try {
        const content = process.env.TOKEN;
        const credentials = JSON.parse(content);
        return google.auth.fromJSON(credentials);
    } catch (err) {
        return null;
    }
}

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
    
    const payload = JSON.stringify({
        type: 'authorized_user',
        client_id: content.installed.client_id,
        client_secret: content.installed.client_secret,
        refresh_token: client.credentials.refresh_token,
    });
    
    await fs.writeFile(TOKEN_PATH, payload);
}

async function authorize() {
    let client = await loadSavedCredentialsIfExist();
    if (client) {
        return client;
    }

    client = await google.auth.getClient({ scopes: SCOPES });
    if (client.credentials) {
        await saveCredentials(client);
    }
    return client;
}

module.exports = {
    authorize
};
