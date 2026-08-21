import { ImageResponse } from 'next/og';

export const runtime = 'edge';
export const alt = 'BOOKCASE. Logo';
export const size = {
  width: 1200,
  height: 630,
};
export const contentType = 'image/png';

export default async function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          background: '#1F1D20',
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <div
          style={{
            fontSize: 160,
            fontFamily: 'sans-serif',
            fontWeight: 900,
            letterSpacing: '-0.02em',
            color: '#F5ECDC',
            display: 'flex',
          }}
        >
          BOOKCASE.
        </div>
      </div>
    ),
    {
      ...size,
    }
  );
}
