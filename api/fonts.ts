import { VercelRequest, VercelResponse } from '@vercel/node';

// Return a stable list of available font "variants". Paths are symbolic for UI display;
// the renderer uses the family name and parses weight/italic from the filename.
export default function handler(_req: VercelRequest, res: VercelResponse) {
  const fonts = [
    {
      family: 'Amiri',
      regular: '/fonts/Amiri/Amiri-Regular.ttf',
      variants: [
        '/fonts/Amiri/Amiri-Regular.ttf',
        '/fonts/Amiri/Amiri-Bold.ttf',
        '/fonts/Amiri/Amiri-Italic.ttf',
        '/fonts/Amiri/Amiri-BoldItalic.ttf',
        '/fonts/Amiri/AmiriQuran.ttf'
      ]
    },
    {
      family: 'Cairo',
      regular: '/fonts/Cairo/Cairo-Regular.ttf',
      variants: [
        '/fonts/Cairo/Cairo-Light.ttf',
        '/fonts/Cairo/Cairo-Regular.ttf',
        '/fonts/Cairo/Cairo-Medium.ttf',
        '/fonts/Cairo/Cairo-SemiBold.ttf',
        '/fonts/Cairo/Cairo-Bold.ttf',
        '/fonts/Cairo/Cairo-Black.ttf',
        '/fonts/Cairo/Cairo-ExtraBold.ttf',
        '/fonts/Cairo/Cairo-ExtraLight.ttf'
      ]
    }
  ];
  res.status(200).json({ fonts });
}


