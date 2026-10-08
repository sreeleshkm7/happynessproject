# HappynessProject

A modern travel discovery and booking web app designed for group trips, curated experiences, and personalized vacation planning. The project presents a polished front-end experience for browsing destinations, saving favorite trips, managing bookings, and completing checkout flows in a mobile-first travel interface.

## Overview

HappynessProject is a static, front-end-only travel platform inspired by destination discovery portals and booking apps. It allows users to:

- Explore destination-focused travel packages
- Filter by theme, budget, and travel window
- View detailed trip information and itinerary highlights
- Save trips to a wishlist
- Add items to a cart and proceed to booking
- Complete a mock booking flow with traveler details
- Review bookings and booking confirmation screens
- Access account-related pages such as login, settings, and support

This repository is intended as a travel UI prototype or demo application rather than a full production backend system.

## Key Features

### Travel discovery experience
- Hero landing page with destination search and curated trip discovery
- Category chips for themes such as adventure, heritage, weekend escapes, and more
- Rich cards showing pricing, dates, ratings, and destination details
- Package detail pages with trip highlights, itinerary sections, and CTA actions

### User actions
- Wishlist tracking using browser local storage
- Cart management for selected trips
- Checkout flow for booking and traveler details
- Booking confirmation and booking history screens
- Authentication-aware UI routing for protected actions

### Travel booking flow
- Multi-step booking page with passenger information forms
- Payment method selection and totals
- Booking ID generation for confirmed reservations
- Local persistence of bookings in browser storage

### Support and account pages
- Login and password reset screens
- About, contact, FAQ, terms, privacy, and help-center pages
- Safety guidelines and cancellation policy pages
- Host-a-trip and group charter experiences

## Tech Stack

- HTML5
- CSS3
- JavaScript (vanilla ES6+)
- Tailwind CSS via CDN
- Supabase JS v2 for authentication and trip-catalogue data
- Supabase-backed wishlist and cart persistence
- Browser sessionStorage only for the temporary trip/traveller checkout hand-off
- Static site structure with multiple HTML pages

## Project Structure

```text
happynessproject/
├── index.html                 # Main landing page
├── README.md                  # Project documentation
├── tools/
│   └── scan_site.py           # Utility script for checking links and assets
├── archive/                   # Non-deployable design and exported assets
├── css/
│   └── style.css              # Shared styling
├── images/                    # Travel imagery and page previews
├── js/
│   ├── api.js                 # Supabase data-access layer, including trip catalogue
│   ├── config.js              # Supabase URL and public anon key placeholders
│   ├── auth.js                # Login/auth guards and session behavior
│   ├── checkout.js            # Booking and checkout logic
│   ├── header.js              # Shared navbar/header rendering
│   ├── main.js                # Core trip browsing, wishlist, and cart behavior
│   ├── supabase-client.js     # Shared Supabase browser client
├── pages/
│   ├── about.html
│   ├── booking.html
│   ├── booking-confirmation.html
│   ├── cart.html
│   ├── customize-trip.html
│   ├── faq.html
│   ├── forgot-password.html
│   ├── host-a-trip.html
│   ├── login.html
│   ├── my-bookings.html
│   ├── package-detail.html
│   ├── privacy.html
│   ├── settings.html
│   ├── terms.html
│   ├── upcoming-events.html
│   ├── wishlist.html
│   └── ...
```

## Main Pages

- `index.html` – home page and trip discovery dashboard
- `pages/package-detail.html` – detailed destination package information
- `pages/booking.html` – traveler and payment details form
- `pages/booking-confirmation.html` – successful booking summary
- `pages/my-bookings.html` – user booking history
- `pages/wishlist.html` – saved favorite trips
- `pages/cart.html` – selected travel items queue
- `pages/login.html` – sign-in flow
- `pages/about.html`, `contact.html`, `faq.html`, `help-center.html` – informational pages

## How the App Works

The app is a static multi-page front end backed by Supabase for authentication and trip-catalogue reads:

- Approved trips and their detail data are loaded through `js/api.js` from Supabase.
- Wishlist and cart data are read and written through `js/api.js` under owner-only Supabase RLS policies.
- Booking records and checkout submission are being migrated in the next phase.
- Supabase Auth session checks redirect users to the login page when protected actions are triggered.
- The layout and styling use a travel-brand design system with warm earth tones, teal accents, and modern card-based UI

## Running the Project

Because this is a static website, there is no complex install or build step.

### Option 1: Open directly
Open `index.html` in a browser.

### Option 2: Serve locally
From the project root, run:

```bash
python3 -m http.server 8000
```

Then visit:

```text
http://localhost:8000
```

## Notes

- This project is intended for UI/UX demonstration and frontend prototyping.
- Supabase Auth and the approved trip catalogue are connected; the Supabase schema and seed still need to be applied in the project dashboard.
- Wishlist and cart persist in Supabase. Booking records are not yet migrated and remain in the existing checkout flow until Phase 5.
- No production payment gateway is connected.

## Suggested Future Enhancements

- Database-backed bookings and inventory tracking
- Payment gateway integration
- Admin dashboard for trip and booking management

## License

This project is currently distributed without a formal license file. If you plan to reuse or share it publicly, it is recommended to add an explicit license before deployment.

## Summary

HappynessProject is a visually rich travel booking prototype that demonstrates how users discover, save, and book curated journeys. It is a strong foundation for a travel startup front end and can be expanded into a full production booking platform with backend services and real user data.
