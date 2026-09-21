// Lead scoring: how worth contacting is this business, and why.
// Tuned for agencies/freelancers selling web, marketing or software services.

export const DEFAULT_WEIGHTS = {
  hasPhone: 8,
  hasEmail: 18,
  noWebsite: 30,
  websiteDown: 24,
  noHttps: 12,
  notMobileFriendly: 12,
  noAnalytics: 5,
  staleSite: 8,
  builderSite: 6,
  noSocial: 6,
  socialOnly: 5,
  lowRating: 5,
  fewReviews: 4,
  slowSite: 4,
  noContactForm: 3,
};

const BUILDERS = ['wix', 'squarespace', 'godaddy-builder', 'webflow'];

/**
 * @returns {{score:number, opportunities:string[]}} score is 0-100, higher = warmer lead.
 */
export function scoreLead(lead, { weights = DEFAULT_WEIGHTS, now = new Date() } = {}) {
  const w = { ...DEFAULT_WEIGHTS, ...weights };
  const opportunities = [];
  let score = 0;
  const add = (points, label) => {
    score += points;
    if (label) opportunities.push(label);
  };

  if (lead.phone) score += w.hasPhone;
  if (lead.email) score += w.hasEmail;

  const socialCount = Object.keys(lead.socials || {}).length;

  if (!lead.website) {
    add(w.noWebsite, 'no-website');
    if (socialCount) add(w.socialOnly, 'social-only-presence');
  } else if (lead.websiteLive === false) {
    add(w.websiteDown, 'website-unreachable');
  } else if (lead.websiteLive) {
    if (lead.https === false) add(w.noHttps, 'no-https');
    if (lead.mobileFriendly === false) add(w.notMobileFriendly, 'not-mobile-friendly');
    if (lead.hasContactForm === false) add(w.noContactForm, 'no-contact-form');

    const tech = lead.tech || [];
    if (!tech.includes('google-analytics') && !tech.includes('facebook-pixel') && !tech.includes('hubspot')) {
      add(w.noAnalytics, 'no-analytics');
    }
    if (tech.some((t) => BUILDERS.includes(t))) add(w.builderSite, 'diy-site-builder');
    if (lead.copyrightYear && now.getFullYear() - lead.copyrightYear >= 3) add(w.staleSite, 'stale-site');
    if (lead.responseMs && lead.responseMs > 2500) add(w.slowSite, 'slow-site');
  }

  if (!socialCount) add(w.noSocial, 'no-social-profiles');
  if (typeof lead.rating === 'number' && lead.rating > 0 && lead.rating < 4 && (lead.reviews ?? 0) >= 5) {
    add(w.lowRating, 'low-rating');
  }
  if (typeof lead.reviews === 'number' && lead.reviews < 10) add(w.fewReviews, 'few-reviews');

  return { score: Math.max(0, Math.min(100, Math.round(score))), opportunities };
}

export function withScore(lead, options) {
  const { score, opportunities } = scoreLead(lead, options);
  return { ...lead, score, opportunities };
}
