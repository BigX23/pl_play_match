# **App Name**: Pleasanton PlayMatch

## Core Features:

- QR Code Registration: Allow new users to quickly register by scanning a QR code at Lifetime Activities Pleasanton.
- User Profile Creation: Collect user data including sport preference (Tennis, Pickleball, or both), age, skill level, gender, type of player (recreational, somewhat competitive, really competitive), preferred playing times, and how often they play.
- Partner Preferences: Allow users to specify desired partner skill levels (slider based on NTRP), gender, age range, and preferred contact details.
- AI Matchmaking: An AI tool to analyze user profiles and preferences to calculate a match score (0-100%) based on compatibility.
- Match Display: Display potential matches to the user with a match score (showing only matches above 70%) and a brief explanation of the score breakdown.
- Profile Picture Upload: Allow users to optionally upload a profile picture during initial registration.
- Playing Style Preferences: Allow users to specify their preferred playing style (e.g., baseline, net play, aggressive, defensive). Use this info in the AI matchmaking tool to improve match quality.
- Match Feedback Mechanism: Incorporate user feedback on previous matches (thumbs up/down) to refine the AI matchmaking tool and improve future recommendations.
- Groups Feature: Implement a 'groups' feature where users can create or join groups based on skill level, age, or playing preferences. This provides an alternative way to find partners outside of the AI matching.
- Court Finder: Add a 'find a court' feature that integrates with the Lifetime Activities Pleasanton reservation system (if API available) or displays court availability information manually.
- Open Match Requests: Allow users to create and post open match requests specifying date, time, and level. Other users can then respond to these requests. Make it possible for the AI matchmaking tool to evaluate users who have posted a match request.

## Style Guidelines:

- A vibrant green (#3CB371) to represent the tennis and pickleball courts.
- Light gray (#F5F5F5) for backgrounds to provide a clean, modern look.
- A bright orange (#FF4500) to highlight important elements and calls to action.
- Clean and readable typography for optimal user experience.
- Mobile-first, responsive layout to mimic a native app feel on various devices.
- Use of clear, intuitive icons for navigation and actions.

## Original User Request:
I live in Pleasanton CA and there is a great Tennis and Pickleball park here called Lifetime Activities Pleasanton. They have a bunch of tennis courts and 4 pickleball courts that anyone can reserve and use for about $10 an hour. The people of Pleasanton love to play Tennis and Pickleball but it is hard to find partners. Not because there's not enough people but because its hard to find someone that is at your same level and around your age and has the same free time as you to play. I want to develop a free web app that people can use to help find Tennis and Pickleball partners here in Pleasanton.

My idea is that it is a web app that people can register on by scanning a QR code that will be on a flyer at the Tennis park. This QR code will bring them to the web app new user registration page where they will create a username and password and then fill out some info about themselves, are they interested in Tennis or Pickleball or both, age, Tennis level according to the NTRP levels chart and Pickleball level if they want Pickleball as well, gender, type of player, recreational - just for exercise, somewhat competitive, or really competitive, and their preferred dates and times to play. Then we need to ask them info about their potential playing partners. THere should be a slider for them to select what levels they want to play against, what gender(s) they want to play against, what age range they want to play against, preferred contact details. Once they have filled out all of this required info then they can submit their profile.

Then the magic happens, this is where you will design a matching algorithm and a ranking system, so if there is a perfect match for them it is 100% then it goes down from there to 0% match. The app will match players and display the potential matches for the user and the score for how well they match and a brief description of why they have the score they do. We should only display matches that meet the 70% or higher match rank.

This is a web app not an app that will be installed on a phone. This way it is easy to use from any device and does not require users to download and install anything. It should be compatible with all major web browsers on desktop or tablet or mobile.

It should have a modern sleek easy to use UI that looks like a mobile app even though it is actually a website.

I also want to allow users to upload a profile picture when they do the initial registration. This is optional, not required.
Another data point that might help us with matching is to ask each user how often do you play. Once per month or less, 2 - 5 times per month, more than 5 times per month.

  