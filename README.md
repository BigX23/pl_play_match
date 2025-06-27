# Pleasanton PlayMatch

## Project Overview

Pleasanton PlayMatch is a web application designed to facilitate matchmaking for tennis players in Pleasanton. The core of the application is its sophisticated matching algorithm and ranking system, which aims to connect players with similar skill levels and preferences. Matches with a compatibility score above 70% are prominently displayed to users.

The application is built as a modern, sleek, and easy-to-use web app that mimics the look and feel of a mobile application. This design approach ensures a seamless and intuitive user experience.

The visual design follows a vibrant color scheme, primarily utilizing vibrant green, light gray, and bright orange to create an engaging and visually appealing interface.

## Features

-   **Sophisticated Matchmaking:** Connects players based on skill level and preferences.
-   **Ranking System:** Provides a system for ranking players.
-   **High Compatibility Matches:** Highlights matches with a compatibility score above 70%.
-   **Modern UI/UX:** Sleek and intuitive design, optimized for a mobile-like experience.
-   **Vibrant Design:** Uses an engaging color scheme of vibrant green, light gray, and bright orange.

## Technology Stack

Pleasanton PlayMatch is built using the following technologies:

-   **Frontend:** Next.js, React, TypeScript
-   **UI Components:** Shadcn UI
-   **Backend:** Node.js (implicitly via Next.js API routes)
-   **Database:** SQLite
-   **Authentication:** Custom SQLite-based authentication (`src/auth/sqlite-auth.ts`)
-   **AI/ML:** The application incorporates AI flows for improving match quality, explaining match scores, and refining matchmaking tools (see `src/ai/`).

## Project Structure

The project is organized with a focus on modularity and maintainability:

-   **`/` (Root):** Contains configuration files like `next.config.ts`, `package.json`, `tsconfig.json`, and this `README.md`.
-   **`/.idx`:** Development-related configuration.
-   **`/.vscode`:** VS Code specific settings.
-   **`/docs`:** Project documentation (e.g., `blueprint.md`).
-   **`/public`:** Static assets like images.
-   **`/src`:** Main source code directory.
    -   **`/src/ai`:** AI-related code for match quality, score explanation, and tool refinement.
    -   **`/src/app`:** Next.js app router structure, including pages, API routes, global styles, and layout.
    -   **`/src/auth`:** Authentication logic, specifically using SQLite.
    -   **`/src/components`:** Reusable UI components, including Shadcn UI components.
    -   **`/src/db`:** Database-related files for SQLite setup and data handling.
    -   **`/src/hooks`:** Custom React hooks.
    -   **`/src/lib`:** Utility functions.
    -   **`/src/services`:** Various service modules.

## Getting Started

To get started with the project, ensure you have Node.js and npm (or yarn) installed.

1.  **Clone the repository:**
    ```bash
    git clone <repository-url>
    cd <repository-directory>
    ```
2.  **Install dependencies:**
    ```bash
    npm install
    # or
    yarn install
    ```
3.  **Set up the database:**
    The application uses SQLite. The database setup might be handled automatically by scripts in `src/db/sqlite-setup.ts`. Refer to the specific scripts for details if manual setup is needed.
4.  **Run the development server:**
    ```bash
    npm run dev
    # or
    yarn dev
    ```
    This will typically start the application on `http://localhost:3000`.

5.  **Explore the code:**
    A good starting point to understand the application flow is `src/app/page.tsx`.

*(Note: The section about Firebase Studio being removed and the detailed file listing from the original README has been integrated into the relevant sections or removed if redundant.)*
