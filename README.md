# Firebase Studio

## Pleasanton PlayMatch

Pleasanton PlayMatch is a web application designed to facilitate matchmaking for players in Pleasanton. The core of the application is its sophisticated matching algorithm and ranking system, which aims to connect players with similar skill levels and preferences. Matches with a compatibility score above 70% are prominently displayed to users.

The application is built as a modern, sleek, and easy-to-use web app that mimics the look and feel of a mobile application. This design approach ensures a seamless and intuitive user experience.

The visual design follows a vibrant color scheme, primarily utilizing vibrant green, light gray, and bright orange to create an engaging and visually appealing interface.

**Technology Stack:**
Pleasanton PlayMatch is built using NextJS. (Firebase Studio removed as backend is now SQLite)

To get started, take a look at src/app/page.tsx.



Here's a summary of the project structure based on the file listing:

Root: Contains configuration files like next.config.ts, package.json, tsconfig.json, and README.md.
/.idx: Contains development-related configuration, specifically a /home/user/studio/.idx/dev.nix file.
/.vscode: Contains VS Code specific settings.
/docs: Includes project documentation, such as /home/user/studio/docs/blueprint.md.
/public: Holds static assets like images (/home/user/studio/public/ntrp-skill-levels.png, /home/user/studio/public/tennis-court.jpg).
/src: This is the main source directory and is further organized into:
/src/ai: Contains AI-related code, including flows for improving match quality (/home/user/studio/src/ai/improve-match-quality.ts), explaining match scores (/home/user/studio/src/ai/explain-match-scores.ts), and refining matchmaking tools (/home/user/studio/src/ai/refine-matchmaking-tools.ts).
/src/app: Follows the Next.js app router structure, with routes for the root (/home/user/studio/src/app/page.tsx), dashboard (/home/user/studio/src/app/dashboard/page.tsx), login (/home/user/studio/src/app/login/page.tsx), and registration (/home/user/studio/src/app/registration/page.tsx). It also includes global CSS (/home/user/studio/src/app/globals.css) and layout files (/home/user/studio/src/app/layout.tsx). API routes are defined within /home/user/studio/src/app/api.
/src/auth: Handles authentication, specifically using /home/user/studio/src/auth/sqlite-auth.ts.
/src/components: Reusable UI components, including a /home/user/studio/src/components/sidebar-nav.tsx and an /home/user/studio/src/components/icons.ts file. It also has a /home/user/studio/src/components/ui subdirectory with a large collection of Shadcn UI components.
/src/db: Contains database-related files, including /home/user/studio/src/db/sqlite-data.ts and /home/user/studio/src/db/sqlite-setup.ts.
# /src/firebase: directory removed as Firebase is no longer used for auth.
/src/hooks: Custom React hooks (/home/user/studio/src/hooks/use-hook.ts).
/src/lib: Utility functions (/home/user/studio/src/lib/utils.ts).
/src/services: Contains various service modules, such as /home/user/studio/src/services/lifetime-activities.ts and /home/user/studio/src/services/qr-code.ts.
Overall, the project seems to follow a modular structure, separating concerns into different directories for better organization and maintainability. It leverages Next.js for the application framework, TypeScript for type safety, and appears to use SQLite for the database. The inclusion of AI flows suggests that the application incorporates some form of machine learning or AI functionality, likely related to matching users based on their profiles and preferences as seen in improve-match-quality.ts. The presence of Shadcn UI components indicates a focus on building a modern and responsive user interface.