# Use Lorekeeper with ChatGPT

ChatGPT can write your Lorekeeper roleplays and save stories into your library. It works with your normal ChatGPT subscription; no API key is needed.

## Connect once

You need a ChatGPT plan that supports developer mode apps (Plus, Pro, Business, Enterprise or Edu) and the ChatGPT website. Menu names may differ slightly as ChatGPT changes.

1. In ChatGPT, open **Settings → Apps** (called "Apps & Connectors" on some accounts).
2. Open **Advanced settings** and turn on **Developer mode**.
3. Back in **Apps**, click **Create app** (or **Create**).
4. Fill in:
   - **Name:** `Lorekeeper`
   - **Description:** `Loads and saves my Lorekeeper roleplays and stories.`
   - **MCP Server URL:** copy it from Lorekeeper → Profile → Account settings → ChatGPT.
   - **Authentication:** `OAuth`. Leave the advanced OAuth fields empty.
5. Tick **I understand and want to continue** / **I trust this application**, then click **Create**.
6. A Lorekeeper page opens. Sign in if asked and click **Allow**. You return to ChatGPT, and Lorekeeper shows up under your apps.

## Use it in a chat

Start a new chat, click **+** → **More** → **Developer mode**, and switch on **Lorekeeper**. Do this in every chat where you want to use it. The first time ChatGPT saves something, it asks you to confirm. You can let it remember your choice for the conversation.

### Start in Lorekeeper, play there

1. In Lorekeeper, create a story, set the language, world and your character, choose **ChatGPT** as the narrator, and save the lobby.
2. Click **Copy start command** and paste it into ChatGPT: `Start: <session ID>`.
3. ChatGPT writes the first chapter and saves it. The chapter and its question appear in Lorekeeper.
4. Answer in Lorekeeper. Once all players have answered, write `Continue` in the **same** ChatGPT chat. Repeat.

### Play in ChatGPT, save to Lorekeeper

Roleplay in ChatGPT as usual. Whenever you like, write `Save this roleplay to Lorekeeper`. Later saves in the same chat update the same story. The story is in your library, and you can keep playing it in Lorekeeper.

### Import a Markdown story

Upload a `.md` file to ChatGPT and write `Save this to Lorekeeper`.

## Disconnect

Lorekeeper → Profile → Account settings → ChatGPT → **Disconnect**. You can also remove the app in ChatGPT's settings.
