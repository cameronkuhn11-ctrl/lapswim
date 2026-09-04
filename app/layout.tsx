import type {Metadata} from 'next';
import './globals.css';
export const metadata:Metadata={title:'LaneFinder — Find your next lap',description:'Compare lap swimming near Wellesley, Massachusetts and McLean, Virginia. Find pool schedules, lengths, phone numbers and per-visit prices.'};
export default function RootLayout({children}:Readonly<{children:React.ReactNode}>){return <html lang="en"><body>{children}</body></html>}
