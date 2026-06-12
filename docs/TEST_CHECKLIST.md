# Test Checklist

This checklist will be expanded as the application is implemented.

## PHASE 00 verification

- [x] Repository metadata checked
- [x] Empty repository status identified
- [x] Initial README created to bootstrap default branch
- [x] Working branch `phase/00-discovery` created
- [x] Project documentation started
- [x] No app code implemented
- [x] No deployment performed
- [x] No secrets committed

## General checks for future phases

Before every commit:

- [ ] Confirm current branch
- [ ] Confirm rollback point
- [ ] Review changed files
- [ ] Check no secrets are included
- [ ] Check changes are limited to current phase scope

When app code exists:

- [ ] Install dependencies successfully
- [ ] Run lint
- [ ] Run typecheck
- [ ] Run build
- [ ] Run tests if available
- [ ] Check key routes locally or in preview

## Public pages

- [ ] Homepage loads
- [ ] How-it-works page loads
- [ ] Categories page loads
- [ ] Category detail pages load
- [ ] City pages load
- [ ] Provider landing page loads
- [ ] About page loads
- [ ] Contact page loads
- [ ] Legal pages load

## Customer request flow

- [ ] Category selection works
- [ ] Region/city selection works
- [ ] Required fields validate
- [ ] Invalid email/phone is rejected
- [ ] Consent checkbox is required
- [ ] Successful submission creates a request
- [ ] Success state is shown
- [ ] Error state is shown when submission fails

## Provider flow

- [ ] Provider application form validates
- [ ] Provider application is saved
- [ ] Pending provider cannot access leads
- [ ] Approved provider can access matching leads
- [ ] Provider can submit an offer

## Admin flow

- [ ] Admin route is protected
- [ ] Non-admin users cannot access admin pages
- [ ] Admin can view providers
- [ ] Admin can approve provider
- [ ] Admin can reject provider
- [ ] Admin can view leads
- [ ] Admin can view offers

## Security and privacy

- [ ] Server-side validation exists for all write actions
- [ ] Role-based access is enforced server-side
- [ ] Rate limiting or anti-spam strategy exists
- [ ] Contact data exposure rules are documented
- [ ] Privacy consent is stored
- [ ] Environment variables are not committed

## Deployment readiness

- [ ] `.env.example` is complete
- [ ] Vercel environment variables are configured
- [ ] Production build passes
- [ ] Production routes tested
- [ ] Rollback plan documented
