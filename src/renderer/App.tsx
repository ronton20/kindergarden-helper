// The shell: language switch, tabs, and the hidden print sheets.

import { useAppState, type TabKey } from './state';
import { ChildrenTab } from './features/children/ChildrenTab';
import { CardStudio } from './features/cards/CardStudio';
import { AttendanceTab } from './features/attendance/AttendanceTab';
import { GraduationTab } from './features/graduation/GraduationTab';
import { MedalsTab } from './features/medals/MedalsTab';
import { PrintAreas } from './features/cards/PrintAreas';
import { COLOURS } from './ui/controls';

export function App() {
  const api = useAppState();
  const { saved, transient, strings: s, setLang, setTab } = api;

  const tabs: Array<{ key: TabKey; label: string }> = [
    { key: 'children', label: s.tabChildren },
    { key: 'large', label: s.tabLarge },
    { key: 'small', label: s.tabSmall },
    { key: 'att', label: s.tabAtt },
    { key: 'grad', label: s.tabGrad },
    { key: 'medals', label: s.tabMedals }
  ];

  const langButton = (lang: 'en' | 'he', label: string) => {
    const on = saved.lang === lang;
    return (
      <button
        type="button"
        onClick={() => setLang(lang)}
        style={{
          border: 'none', cursor: 'pointer', height: 44, padding: '0 20px', borderRadius: 999,
          font: '700 18px Rubik,sans-serif',
          background: on ? COLOURS.accent : 'transparent',
          color: on ? '#fff' : COLOURS.ink
        }}
      >{label}</button>
    );
  };

  return (
    <div className="kh-root" dir={saved.lang === 'he' ? 'rtl' : 'ltr'}
      style={{ minHeight: '100vh', background: COLOURS.paper, color: COLOURS.ink }}>
      <div className="kh-screen" style={{ maxWidth: 1120, margin: '0 auto', padding: '24px 20px 80px' }}>

        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          gap: 16, flexWrap: 'wrap', marginBottom: 8
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{
              width: 52, height: 52, borderRadius: 16, background: COLOURS.accent,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: '#fff', font: '900 26px Rubik,sans-serif'
            }}>ג</div>
            <div style={{ font: '900 30px Rubik,sans-serif' }}>{s.appTitle}</div>
          </div>
          <div style={{
            display: 'flex', gap: 8, background: COLOURS.white,
            border: `2px solid ${COLOURS.line}`, borderRadius: 999, padding: 5
          }}>
            {langButton('en', 'English')}
            {langButton('he', 'עברית')}
          </div>
        </div>

        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', margin: '18px 0 26px' }}>
          {tabs.map(({ key, label }) => {
            const on = key === transient.activeTab;
            return (
              <button
                key={key}
                type="button"
                onClick={() => setTab(key)}
                style={{
                  border: `2px solid ${on ? COLOURS.accent : COLOURS.line}`,
                  background: on ? COLOURS.accent : COLOURS.white,
                  color: on ? '#fff' : COLOURS.ink,
                  cursor: 'pointer', height: 60, padding: '0 26px', borderRadius: 16,
                  font: '700 19px Rubik,sans-serif', display: 'flex', alignItems: 'center', gap: 10
                }}
              >{label}</button>
            );
          })}
        </div>

        {transient.activeTab === 'children' && <ChildrenTab api={api} />}
        {transient.activeTab === 'large' && <CardStudio api={api} studio="large" />}
        {transient.activeTab === 'small' && <CardStudio api={api} studio="small" />}
        {transient.activeTab === 'att' && <AttendanceTab api={api} />}
        {transient.activeTab === 'grad' && <GraduationTab api={api} />}
        {transient.activeTab === 'medals' && <MedalsTab api={api} />}
      </div>

      {/* Always mounted, always hidden on screen: printToPDF renders whichever
          one the body's data-print attribute names, and it has to already be
          in the document when that happens. */}
      <PrintAreas saved={saved} />
    </div>
  );
}
