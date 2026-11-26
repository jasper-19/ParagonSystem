export type InformationPageKey =
  | 'our-story'
  | 'ethics-policy'
  | 'contact-us'
  | 'privacy-policy'
  | 'terms-of-service';

export interface InformationSection {
  id: string;
  title: string;
  paragraphs: readonly string[];
  items?: readonly string[];
}

export interface InformationPage {
  title: string;
  introduction: string;
  draft?: boolean;
  sections: readonly InformationSection[];
}

// Policy drafts remain visibly labelled and noindex until publication approval.
// Do not add effective dates or legal commitments without approved source copy.
export const INFORMATION_PAGES: Readonly<Record<InformationPageKey, InformationPage>> = {
  'our-story': {
    title: 'Our Story',
    introduction: 'Campus journalism, student perspectives, and the stories that connect our community.',
    sections: [
      {
        id: 'the-publication', title: 'A publication for the campus community',
        paragraphs: [
          'Paragon brings together campus news, student perspectives, and creative work in one place. This website is a home for the publication\u2019s articles and special issues, and for the people who make them.',
          'From news and sports to features, editorials, development communication, columns, and literary writing, readers can explore the different voices of campus life.',
        ],
      },
      {
        id: 'our-work', title: 'Stories in more than one form',
        paragraphs: [
          'Read individual articles, browse the latest stories by category, or spend time with a complete publication. The special-issues library brings newsletters, tabloids, and literary folios into a dedicated reading experience.',
          'The work extends beyond the byline. Writers, editors, photographers, artists, and publication staff contribute to the stories readers see.',
        ],
      },
      {
        id: 'the-people', title: 'Meet the people behind the pages',
        paragraphs: [
          'The editorial board introduces the students and advisers behind Paragon. Visit the board to explore the publication\u2019s teams, or the recruitment page to learn about contributing.',
        ],
      },
    ],
  },
  'ethics-policy': {
    title: 'Ethics Policy',
    introduction: 'A proposed framework for accurate reporting, fair representation, and accountability to readers.',
    draft: true,
    sections: [
      {
        id: 'accuracy', title: 'Accuracy and verification',
        paragraphs: ['The proposed standard is to verify facts before publication, distinguish confirmed information from uncertainty, and provide context that helps readers understand a story.'],
        items: ['Check names, quotations, dates, and the sources behind factual claims.', 'Clearly distinguish news reporting, opinion, and creative work.', 'Avoid headlines or visual edits that misrepresent the underlying story.'],
      },
      {
        id: 'fairness', title: 'Fairness and care',
        paragraphs: ['Reporting should treat people with dignity and take care when covering sensitive experiences. The proposed approach is to seek relevant perspectives, consider potential harm, and avoid unnecessary disclosure of personal information.'],
      },
      {
        id: 'independence', title: 'Independence and attribution',
        paragraphs: ['This draft proposes transparent attribution of reporting, photography, artwork, and other contributions. Potential conflicts of interest should be raised with the editorial team before work is published.'],
        items: ['Credit original sources and contributors.', 'Do not present another person\u2019s work as original reporting.', 'Make any relevant relationship or outside influence clear to the editors.'],
      },
      {
        id: 'corrections', title: 'Corrections and reader concerns',
        paragraphs: ['Readers can use the Contact Us page to raise a concern about an article. Include the article title or link, the passage in question, and supporting information so the editorial team can assess it.'],
      },
      {
        id: 'policy-review', title: 'Editorial review',
        paragraphs: ['These principles are proposed wording for publication review. The editorial team must confirm the final standards, correction process, and responsibilities before this becomes an adopted policy.'],
      },
    ],
  },
  'contact-us': {
    title: 'Contact Us',
    introduction: 'Have a story to share, a correction to suggest, or a question about the publication? Get in touch.',
    sections: [
      {
        id: 'get-in-touch', title: 'Start a conversation',
        paragraphs: ['Choose a subject below to open an email to the publication, or reach Paragon through its Facebook page.'],
      },
      {
        id: 'helpful-details', title: 'Help us understand your message',
        paragraphs: ['For a correction or a question about a story, include the article title and link. For a story suggestion, describe what happened, where, and why it matters to the campus community.'],
        items: ['Add a clear subject and the details relevant to your question.', 'Share only the personal information needed for your message.', 'For staff opportunities, use the recruitment page and its application form.'],
      },
    ],
  },
  'privacy-policy': {
    title: 'Privacy Policy',
    introduction: 'An overview of the information involved in reading, contacting, and applying to the publication.',
    draft: true,
    sections: [
      {
        id: 'reading', title: 'Reading the publication',
        paragraphs: ['Articles, special issues, and the editorial board can be read without creating a reader account. Staff administration uses a separate sign-in area.'],
      },
      {
        id: 'information-you-share', title: 'Information you choose to share',
        paragraphs: ['Contacting the publication by email or Facebook shares the information you include with the recipient and the service you use. Recruitment applications ask for information relevant to joining the publication. Review the application form before submitting personal information.'],
      },
      {
        id: 'browser-preferences', title: 'Browser preferences and permissions',
        paragraphs: ['The website can remember display preferences in your browser. Features that request device permissions, such as location-based weather, depend on your browser settings; you can decline or change those permissions.'],
      },
      {
        id: 'external-services', title: 'Links and external services',
        paragraphs: ['Following a Facebook link or opening your email application takes you to a separate service. That service has its own privacy settings and policies.'],
      },
      {
        id: 'privacy-questions', title: 'Questions about your information',
        paragraphs: ['Use Contact Us to ask the publication about information you have shared. Describe the relevant interaction without including passwords, account credentials, or unnecessary sensitive details.'],
      },
      {
        id: 'privacy-review', title: 'Details awaiting confirmation',
        paragraphs: ['This draft is not a complete, adopted privacy notice. The publication must confirm its responsible contact, purposes of processing, service providers, retention periods, applicable rights, and request procedures before approval.'],
      },
    ],
  },
  'terms-of-service': {
    title: 'Terms of Service',
    introduction: 'Proposed guidance for reading, sharing, and using the publication\u2019s website responsibly.',
    draft: true,
    sections: [
      {
        id: 'using-the-site', title: 'Using the website',
        paragraphs: ['This website provides access to Paragon\u2019s journalism, special issues, editorial board, and recruitment information. These draft terms describe intended use and remain subject to publication review.'],
      },
      {
        id: 'sharing-work', title: 'Sharing and attribution',
        paragraphs: ['Share links to articles and special issues with their original titles and credits. Contact the publication before reproducing or adapting its text, photographs, illustrations, or complete publications when permission is needed.'],
      },
      {
        id: 'responsible-use', title: 'Responsible use',
        paragraphs: ['The proposed expectations are to respect contributors and other readers and use the website\u2019s public features for their intended purpose.'],
        items: ['Do not attempt to access staff accounts or restricted content without authorization.', 'Do not interfere with the website or submit harmful files.', 'Do not impersonate another person when contacting or applying to the publication.'],
      },
      {
        id: 'external-links', title: 'Other websites and services',
        paragraphs: ['Links to social media or other external websites lead to services outside this publication website. Review their own terms and settings before using them.'],
      },
      {
        id: 'availability', title: 'Availability and questions',
        paragraphs: ['The website may display a maintenance notice while it is unavailable. If you have a question about the publication or its content, use the Contact Us page.'],
      },
      {
        id: 'terms-review', title: 'Terms awaiting approval',
        paragraphs: ['This draft does not establish an approved legal agreement. The publication must confirm the applicable ownership, permissions, responsibilities, and any other required terms before adoption.'],
      },
    ],
  },
};
