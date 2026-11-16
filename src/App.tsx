import { useEffect, useMemo, useRef, useState } from 'react';
import { api } from '@appdeploy/client';
import { auth } from '@appdeploy/client';
import {
  Activity,
  ArrowDownRight,
  ArrowUpRight,
  Bell,
  BriefcaseBusiness,
  CalendarDays,
  Check,
  ChevronDown,
  CircleDollarSign,
  Clock3,
  FileText,
  FolderKanban,
  LayoutDashboard,
  LogOut,
  Menu,
  Plus,
  Search,
  Settings,
  Users,
  X,
} from 'lucide-react';

type Client = {
  id: string;
  name: string;
  company: string;
  email: string;
  phone: string;
  status: string;
  createdAt: string;
};
type Project = {
  id: string;
  name: string;
  clientId: string;
  clientName: string;
  service: string;
  status: string;
  dueDate: string;
  budget: number;
  budgetMinor?: number;
  progress: number;
  createdAt: string;
};
type Invoice = {
  id: string;
  number: string;
  clientId: string;
  clientName: string;
  amount: number;
  paid: number;
  amountMinor?: number;
  paidMinor?: number;
  dueDate: string;
  status: string;
  createdAt: string;
};
type Data = { clients: Client[]; projects: Project[]; invoices: Invoice[] };
type RecordKind = keyof Data;
type RecordItem = Client | Project | Invoice;
type WorkspacePage = { items: RecordItem[]; nextToken?: string };
type Section = 'Overview' | 'Clients' | 'Projects' | 'Invoices';

const empty: Data = { clients: [], projects: [], invoices: [] };
const toMinorUnits = (amount: number) =>
  Math.round((Number.isFinite(amount) ? amount : 0) * 100);
const projectBudgetMinor = (project: Project) =>
  typeof project.budgetMinor === 'number' &&
  Number.isSafeInteger(project.budgetMinor)
    ? project.budgetMinor
    : toMinorUnits(project.budget);
const invoiceAmountMinor = (invoice: Invoice) =>
  typeof invoice.amountMinor === 'number' &&
  Number.isSafeInteger(invoice.amountMinor)
    ? invoice.amountMinor
    : toMinorUnits(invoice.amount);
const invoicePaidMinor = (invoice: Invoice) =>
  typeof invoice.paidMinor === 'number' &&
  Number.isSafeInteger(invoice.paidMinor)
    ? invoice.paidMinor
    : toMinorUnits(invoice.paid);
const moneyMinor = (minor: number) =>
  new Intl.NumberFormat('en-KE', {
    style: 'currency',
    currency: 'KES',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format((Number.isFinite(minor) ? minor : 0) / 100);
const dateLabel = (value: string) =>
  value
    ? new Date(value + 'T00:00:00').toLocaleDateString('en-KE', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      })
    : 'Not set';

function App() {
  const [user, setUser] = useState<{
    userId: string;
    name?: string;
    email?: string;
  } | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [data, setData] = useState<Data>(empty);
  const [nextTokens, setNextTokens] = useState<Partial<Record<RecordKind, string>>>({});
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState<RecordKind | null>(null);
  const [section, setSection] = useState<Section>('Overview');
  const [query, setQuery] = useState('');
  const [modal, setModal] = useState<'client' | 'project' | 'invoice' | null>(
    null
  );
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState('');
  const [mobileNav, setMobileNav] = useState(false);

  async function loadData() {
    setLoading(true);
    try {
      const result = await api.get('/api/workspace');
      const workspace = result.data as Data & {
        nextTokens?: Partial<Record<RecordKind, string>>;
      };
      setData({
        clients: workspace.clients || [],
        projects: workspace.projects || [],
        invoices: workspace.invoices || [],
      });
      setNextTokens(workspace.nextTokens || {});
    } catch {
      setNotice('Could not load your workspace. Please refresh and try again.');
    } finally {
      setLoading(false);
    }
  }

  async function loadMore(kind: RecordKind) {
    const cursor = nextTokens[kind];
    if (!cursor || loadingMore) return;

    setLoadingMore(kind);
    try {
      const result = await api.get(
        '/api/workspace?kind=' + kind + '&cursor=' + encodeURIComponent(cursor)
      );
      const page = result.data as WorkspacePage;
      const existingIds = new Set(data[kind].map(item => item.id));
      const newItems = page.items.filter(item => !existingIds.has(item.id));

      setData(previous => ({
        ...previous,
        [kind]: [...previous[kind], ...newItems],
      }) as Data);
      setNextTokens(previous => ({
        ...previous,
        [kind]: page.nextToken,
      }));
    } catch {
      setNotice('Could not load more records. Please try again.');
    } finally {
      setLoadingMore(null);
    }
  }

  useEffect(() => {
    auth
      .getUser()
      .then(async current => {
        setUser(current);
        if (current) await loadData();
      })
      .catch(() =>
        setNotice('Sign-in could not be restored. Please try again.')
      )
      .finally(() => setAuthLoading(false));
  }, []);

  async function createRecord(
    kind: 'clients' | 'projects' | 'invoices',
    payload: Record<string, unknown>
  ) {
    setSaving(true);
    try {
      await api.post('/api/' + kind, payload);
      await loadData();
      setModal(null);
      setNotice('Saved successfully.');
    } catch {
      setNotice('Save failed. Check the details and try again.');
    } finally {
      setSaving(false);
    }
  }

  async function updateProject(project: Project, patch: Partial<Project>) {
    try {
      await api.put('/api/projects/' + project.id, { ...project, ...patch });
      await loadData();
      setNotice('Project updated.');
    } catch {
      setNotice('Could not update the project.');
    }
  }

  const stats = useMemo(() => {
    const revenueMinor = data.invoices.reduce(
      (sum, item) => sum + invoicePaidMinor(item),
      0
    );
    const outstandingMinor = data.invoices.reduce(
      (sum, item) =>
        sum + Math.max(0, invoiceAmountMinor(item) - invoicePaidMinor(item)),
      0
    );
    const active = data.projects.filter(p => p.status !== 'Completed').length;
    return {
      revenueMinor,
      outstandingMinor,
      active,
      clients: data.clients.length,
    };
  }, [data]);

  const filteredClients = data.clients.filter(c =>
    (c.name + ' ' + c.company + ' ' + c.email)
      .toLowerCase()
      .includes(query.toLowerCase())
  );
  const filteredProjects = data.projects.filter(p =>
    (p.name + ' ' + p.clientName + ' ' + p.service)
      .toLowerCase()
      .includes(query.toLowerCase())
  );
  const filteredInvoices = data.invoices.filter(i =>
    (i.number + ' ' + i.clientName).toLowerCase().includes(query.toLowerCase())
  );
  const activeKind: RecordKind | null =
    section === 'Clients'
      ? 'clients'
      : section === 'Projects'
        ? 'projects'
        : section === 'Invoices'
          ? 'invoices'
          : null;

  if (authLoading)
    return (
      <div className="loading-screen">
        <div className="brand-mark">JK</div>
        <p>Preparing your workspace…</p>
      </div>
    );
  if (!user)
    return (
      <main className="login-screen">
        <div className="login-card">
          <div className="brand-mark">JK</div>
          <p className="eyebrow">JK TECH CODE</p>
          <h1>Your business, clearly managed.</h1>
          <p className="muted">
            Keep clients, projects, deadlines and payments organized in one
            secure workspace.
          </p>
          <button
            className="primary wide"
            onClick={() =>
              auth
                .signInWithRedirect()
                .catch(() =>
                  setNotice(
                    'Sign-in could not start. Check browser storage and try again.'
                  )
                )
            }          >
            Continue to sign in <ArrowUpRight size={17} />
          </button>
          <p className="tiny">Secure sign-in powered by AppDeploy.</p>
          {notice && <p className="notice">{notice}</p>}
        </div>
      </main>
    );

  const nav: { label: Section; icon: typeof LayoutDashboard }[] = [
    { label: 'Overview', icon: LayoutDashboard },
    { label: 'Clients', icon: Users },
    { label: 'Projects', icon: FolderKanban },
    { label: 'Invoices', icon: FileText },
  ];

  return (
    <div className="app-shell">
      <aside className={'sidebar ' + (mobileNav ? 'show' : '')}>
        <div className="brand">
          <div className="brand-mark small">JK</div>
          <div>
            <strong>JK TECH CODE</strong>
            <span>WORKSPACE</span>
          </div>
          <button
            className="icon-button close-nav"
            onClick={() => setMobileNav(false)}
          >
            <X size={18} />
          </button>
        </div>
        <div className="workspace-label">WORKSPACE</div>
        <nav>
          {nav.map(item => (
            <button
              key={item.label}
              className={'nav-item ' + (section === item.label ? 'active' : '')}
              onClick={() => {
                setSection(item.label);
                setMobileNav(false);
                setQuery('');
              }}
            >
              <item.icon size={18} />
              {item.label}
              {item.label === 'Projects' && (
                <span className="nav-count">{stats.active}</span>
              )}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="help-card">
            <div className="help-icon">
              <Activity size={17} />
            </div>
            <strong>Stay on top of work</strong>
            <p>Track every project from enquiry to delivery.</p>
          </div>
          <button
            className="profile-row"
            onClick={() => auth.signOut().then(() => setUser(null))}
          >
            <div className="avatar">
              {(user.name || user.email || 'J').charAt(0).toUpperCase()}
            </div>
            <div className="profile-copy">
              <strong>{user.name || 'Workspace owner'}</strong>
              <span>{user.email || 'Signed in'}</span>
            </div>
            <LogOut size={16} />
          </button>
        </div>
      </aside>
      {mobileNav && (
        <button
          className="scrim"
          aria-label="Close navigation"
          onClick={() => setMobileNav(false)}
        />
      )}
      <main className="main-area">
        <header className="topbar">
          <button
            className="icon-button mobile-menu"
            onClick={() => setMobileNav(true)}
          >
            <Menu size={20} />
          </button>
          <div className="breadcrumb">
            Workspace <span>/</span> <strong>{section}</strong>
          </div>
          <div className="top-actions">
            <span className="today">
              <CalendarDays size={15} />{' '}
              {new Date().toLocaleDateString('en-KE', {
                weekday: 'short',
                day: 'numeric',
                month: 'short',              })}
            </span>
            <button className="icon-button notification" title="Notifications">
              <Bell size={18} />
            </button>
            <div className="avatar top-avatar">
              {(user.name || user.email || 'J').charAt(0).toUpperCase()}
            </div>
          </div>
        </header>
        <div className="content">
          <div className="page-heading">
            <div>
              <p className="eyebrow">JK TECH CODE / BUSINESS HUB</p>
              <h1>{section === 'Overview' ? 'Good to see you' : section}</h1>
              <p className="muted">
                {section === 'Overview'
                  ? 'Here is what is happening across your business.'
                  : section === 'Clients'
                    ? 'Manage relationships, contacts and incoming opportunities.'
                    : section === 'Projects'
                      ? 'Keep delivery, budgets and deadlines moving.'
                      : 'Track invoices, payments and outstanding balances.'}
              </p>
            </div>
            <div className="heading-actions">
              {section !== 'Overview' && (
                <button
                  className="primary"
                  onClick={() =>
                    setModal(
                      section === 'Clients'
                        ? 'client'
                        : section === 'Projects'
                          ? 'project'
                          : 'invoice'
                    )
                  }
                >
                  <Plus size={17} /> Add {section.slice(0, -1)}
                </button>
              )}
            </div>
          </div>
          {notice && (
            <div className="notice-bar">
              {notice}
              <button onClick={() => setNotice('')}>
                <X size={15} />
              </button>
            </div>
          )}
          {section === 'Overview' && (
            <>
              <div className="stats-grid">
                <Stat
                  icon={<Users />}
                  label="Total clients"
                  value={String(stats.clients)}
                  hint="Your client directory"
                  tone="blue"
                />
                <Stat
                  icon={<FolderKanban />}
                  label="Active projects"
                  value={String(stats.active)}
                  hint="Currently in progress"
                  tone="violet"
                />
                <Stat
                  icon={<CircleDollarSign />}
                  label="Collected revenue"
                  value={moneyMinor(stats.revenueMinor)}
                  hint="Payments received"
                  tone="green"
                />
                <Stat
                  icon={<Clock3 />}
                  label="Outstanding"
                  value={moneyMinor(stats.outstandingMinor)}
                  hint="Awaiting payment"
                  tone="amber"
                />
              </div>
              <div className="dashboard-grid">
                <section className="panel">
                  <div className="panel-heading">
                    <div>
                      <h2>Recent projects</h2>
                      <p>Monitor your latest work</p>
                    </div>
                    <button
                      className="text-button"
                      onClick={() => setSection('Projects')}
                    >
                      View all <ArrowUpRight size={15} />
                    </button>
                  </div>
                  {data.projects.length ? (
                    <div className="project-list">                      {data.projects.slice(0, 5).map(p => (
                        <div className="project-row" key={p.id}>
                          <div className="project-symbol">
                            <BriefcaseBusiness size={18} />
                          </div>
                          <div className="project-info">
                            <strong>{p.name}</strong>
                            <span>{p.clientName || 'Client not assigned'}</span>
                            <div className="progress-track">
                              <i style={{ width: p.progress + '%' }} />
                            </div>
                          </div>
                          <div className="project-meta">
                            <Status value={p.status} />
                            <span>{p.progress}%</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <Empty
                      icon={<FolderKanban />}
                      title="No projects yet"
                      text="Create your first project to start tracking delivery."
                      action="Add project"
                      onClick={() => setModal('project')}
                    />
                  )}
                </section>
                <section className="panel">
                  <div className="panel-heading">
                    <div>
                      <h2>Financial snapshot</h2>
                      <p>Payments at a glance</p>
                    </div>
                    <CircleDollarSign size={20} className="subtle-icon" />
                  </div>
                  <div className="finance-block">
                    <span>Collected</span>
                    <strong>{moneyMinor(stats.revenueMinor)}</strong>
                    <div className="finance-line">
                      <i
                        style={{
                          width:
                            stats.revenue + stats.outstanding
                              ? (stats.revenue /
                                  (stats.revenue + stats.outstanding)) *
                                  100 +
                                '%'
                              : '0%',
                        }}
                      />
                    </div>
                    <div className="finance-legend">
                      <span>
                        <i className="dot green-dot" />
                        Received
                      </span>
                      <span>
                        <i className="dot amber-dot" />
                        Pending
                      </span>
                    </div>
                  </div>
                  <div className="mini-stat">
                    <span>Outstanding balance</span>
                    <strong>{moneyMinor(stats.outstandingMinor)}</strong>
                  </div>
                  <div className="mini-stat">
                    <span>Invoices issued</span>
                    <strong>{data.invoices.length}</strong>
                  </div>
                  <button
                    className="secondary wide"
                    onClick={() => setSection('Invoices')}
                  >
                    Manage invoices <ArrowUpRight size={16} />
                  </button>
                </section>
              </div>
              <section className="panel quick-panel">
                <div>
                  <h2>Quick actions</h2>
                  <p>Get things moving in a few clicks.</p>
                </div>
                <div className="quick-actions">
                  <Quick
                    icon={<Users />}
                    label="Add a client"
                    onClick={() => setModal('client')}
                  />
                  <Quick
                    icon={<FolderKanban />}
                    label="Create project"
                    onClick={() => setModal('project')}
                  />
                  <Quick
                    icon={<FileText />}
                    label="New invoice"
                    onClick={() => setModal('invoice')}                  />
                </div>
              </section>
            </>
          )}
          {section !== 'Overview' && (
            <section className="panel table-panel">
              <div className="table-toolbar">
                <div className="search-box">
                  <Search size={17} />
                  <input
                    value={query}
                    onChange={e => setQuery(e.target.value)}
                    placeholder={'Search ' + section.toLowerCase() + '…'}
                  />
                </div>
                <span className="record-count">
                  {section === 'Clients'
                    ? filteredClients.length
                    : section === 'Projects'
                      ? filteredProjects.length
                      : filteredInvoices.length}{' '}
                  {activeKind && nextTokens[activeKind] ? 'loaded' : 'records'}
                </span>
              </div>
              {loading ? (
                <div className="table-empty">Loading workspace…</div>
              ) : section === 'Clients' ? (
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>CLIENT</th>
                        <th>EMAIL / PHONE</th>
                        <th>STATUS</th>
                        <th>ADDED</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredClients.map(c => (
                        <tr key={c.id}>
                          <td>
                            <div className="cell-main">
                              <div className="avatar">
                                {c.name.charAt(0).toUpperCase()}
                              </div>
                              <div>
                                <strong>{c.name}</strong>
                                <span>{c.company}</span>
                              </div>
                            </div>
                          </td>
                          <td>
                            {c.email}
                            <span className="cell-sub">{c.phone}</span>
                          </td>
                          <td>
                            <Status value={c.status} />
                          </td>
                          <td>{dateLabel(c.createdAt?.slice(0, 10))}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {!filteredClients.length && (
                    <Empty
                      icon={<Users />}
                      title="No clients found"
                      text="Add a client or adjust your search."
                      action="Add client"
                      onClick={() => setModal('client')}
                    />
                  )}
                </div>
              ) : section === 'Projects' ? (
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>PROJECT</th>
                        <th>STATUS</th>
                        <th>PROGRESS</th>
                        <th>DEADLINE</th>
                        <th>BUDGET</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredProjects.map(p => (
                        <tr key={p.id}>
                          <td>
                            <div className="cell-main">
                              <div className="project-symbol">
                                <BriefcaseBusiness size={17} />
                              </div>
                              <div>
                                <strong>{p.name}</strong>
                                <span>
                                  {p.clientName} · {p.service}
                                </span>
                              </div>                            </div>
                          </td>
                          <td>
                            <select
                              className="status-select"
                              value={p.status}
                              onChange={e =>
                                updateProject(p, { status: e.target.value })
                              }
                            >
                              <option>Planning</option>
                              <option>In Progress</option>
                              <option>On Hold</option>
                              <option>Completed</option>
                            </select>
                          </td>
                          <td>
                            <div className="progress-cell">
                              <div className="progress-track">
                                <i style={{ width: p.progress + '%' }} />
                              </div>
                              <span>{p.progress}%</span>
                            </div>
                          </td>
                          <td>{dateLabel(p.dueDate)}</td>
                          <td>{moneyMinor(projectBudgetMinor(p))}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {!filteredProjects.length && (
                    <Empty
                      icon={<FolderKanban />}
                      title="No projects found"
                      text="Create a project to track its progress."
                      action="Add project"
                      onClick={() => setModal('project')}
                    />
                  )}
                </div>
              ) : (
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>INVOICE</th>
                        <th>CLIENT</th>
                        <th>AMOUNT</th>
                        <th>PAID</th>
                        <th>DUE DATE</th>
                        <th>STATUS</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredInvoices.map(i => (
                        <tr key={i.id}>
                          <td>
                            <strong>{i.number}</strong>
                          </td>
                          <td>{i.clientName}</td>
                          <td>{moneyMinor(invoiceAmountMinor(i))}</td>
                          <td>{moneyMinor(invoicePaidMinor(i))}</td>
                          <td>{dateLabel(i.dueDate)}</td>
                          <td>
                            <Status
                              value={
                                invoicePaidMinor(i) >= invoiceAmountMinor(i)
                                  ? 'Paid'
                                  : invoicePaidMinor(i) > 0
                                    ? 'Partially Paid'
                                    : i.status
                              }
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {!filteredInvoices.length && (
                    <Empty
                      icon={<FileText />}
                      title="No invoices found"
                      text="Create an invoice to track client payments."
                      action="New invoice"
                      onClick={() => setModal('invoice')}
                    />
                  )}
                </div>
              )}
              {activeKind && nextTokens[activeKind] && (
                <div className="table-pagination">
                  <span>
                    {data[activeKind].length} records loaded. More records are available.
                  </span>
                  <button
                    className="secondary"
                    disabled={loadingMore !== null}
                    onClick={() => loadMore(activeKind)}
                  >
                    {loadingMore === activeKind ? 'Loading…' : 'Load more'}
                  </button>
                </div>
              )}
            </section>
          )}
          <footer className="footer">
            <span>© {new Date().getFullYear()} JK Tech Code</span>
            <span>Built for better business management</span>
          </footer>
        </div>
      </main>
      {modal && (
        <RecordModal
          kind={modal}          clients={data.clients}
          saving={saving}
          onClose={() => setModal(null)}
          onSave={createRecord}
        />
      )}
    </div>
  );
}

function Stat({
  icon,
  label,
  value,
  hint,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  hint: string;
  tone: string;
}) {
  return (
    <div className="stat-card">
      <div className={'stat-icon ' + tone}>{icon}</div>
      <span className="stat-label">{label}</span>
      <strong className="stat-value">{value}</strong>
      <span className="stat-hint">{hint}</span>
    </div>
  );
}
function Status({ value }: { value: string }) {
  const tone =
    value.toLowerCase().includes('complete') ||
    value.toLowerCase() === 'paid' ||
    value.toLowerCase() === 'active'
      ? 'green'
      : value.toLowerCase().includes('hold') ||
          value.toLowerCase().includes('pending') ||
          value.toLowerCase().includes('partial')
        ? 'amber'
        : value.toLowerCase().includes('progress')
          ? 'blue'
          : 'slate';
  return (
    <span className={'status ' + tone}>
      <i />
      {value}
    </span>
  );
}
function Empty({
  icon,
  title,
  text,
  action,
  onClick,
}: {
  icon: React.ReactNode;
  title: string;
  text: string;
  action: string;
  onClick: () => void;
}) {
  return (
    <div className="empty-state">
      <div className="empty-icon">{icon}</div>
      <strong>{title}</strong>
      <p>{text}</p>
      <button className="secondary" onClick={onClick}>
        <Plus size={15} />
        {action}
      </button>
    </div>
  );
}
function Quick({
  icon,
  label,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <button className="quick-action" onClick={onClick}>
      <span>{icon}</span>
      <strong>{label}</strong>
      <ArrowUpRight size={15} />
    </button>
  );
}
function RecordModal({
  kind,
  clients,
  saving,
  onClose,
  onSave,}: {
  kind: 'client' | 'project' | 'invoice';
  clients: Client[];
  saving: boolean;
  onClose: () => void;
  onSave: (
    kind: 'clients' | 'projects' | 'invoices',
    payload: Record<string, unknown>
  ) => Promise<void>;
}) {
  const [form, setForm] = useState<Record<string, string>>({});
  const requestRef = useRef<{ signature: string; id: string } | null>(null);
  const change = (key: string, value: string) =>
    setForm(prev => ({ ...prev, [key]: value }));
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const client = clients.find(c => c.id === form.clientId);
    let targetKind: 'clients' | 'projects' | 'invoices';
    let payload: Record<string, unknown>;

    if (kind === 'client') {
      targetKind = 'clients';
      payload = { ...form, status: form.status || 'Active' };
    } else if (kind === 'project') {
      targetKind = 'projects';
      payload = {
        ...form,
        clientName: client?.name || '',
        budget: Number(form.budget || 0),
        progress: Number(form.progress || 0),
        status: form.status || 'Planning',
      };
    } else {
      targetKind = 'invoices';
      payload = {
        ...form,
        clientName: client?.name || '',
        amount: Number(form.amount || 0),
        paid: Number(form.paid || 0),
        status: 'Unpaid',
        number: form.number || '',
      };
    }

    const signature = JSON.stringify({ kind: targetKind, payload });
    if (!requestRef.current || requestRef.current.signature !== signature) {
      requestRef.current = { signature, id: crypto.randomUUID() };
    }
    onSave(targetKind, { ...payload, requestId: requestRef.current.id });
  };
  const title =
    kind === 'client'
      ? 'Add a client'
      : kind === 'project'
        ? 'Create a project'
        : 'Create an invoice';
  return (
    <div
      className="modal-backdrop"
      onMouseDown={e => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <form className="modal-card" onSubmit={submit}>
        <div className="modal-heading">
          <div>
            <p className="eyebrow">WORKSPACE RECORD</p>
            <h2>{title}</h2>
          </div>
          <button type="button" className="icon-button" onClick={onClose}>
            <X size={19} />
          </button>
        </div>
        {kind === 'client' && (
          <>
            <Field
              label="Client name"
              required
              value={form.name || ''}
              onChange={v => change('name', v)}
              placeholder="e.g. Acme Limited"
            />
            <Field
              label="Company / organization"
              value={form.company || ''}
              onChange={v => change('company', v)}
              placeholder="Company name"
            />
            <div className="form-grid">
              <Field
                label="Email address"
                type="email"
                value={form.email || ''}
                onChange={v => change('email', v)}
                placeholder="client@example.com"
              />
              <Field
                label="Phone number"
                value={form.phone || ''}
                onChange={v => change('phone', v)}
                placeholder="+254…"
              />
            </div>
            <Field
              label="Status"
              select
              value={form.status || 'Active'}
              onChange={v => change('status', v)}
              options={['Active', 'Lead', 'Inactive']}
            />
          </>
        )}
        {kind === 'project' && (          <>
            <Field
              label="Project name"
              required
              value={form.name || ''}
              onChange={v => change('name', v)}
              placeholder="e.g. Company website"
            />
            <Field
              label="Client"
              select
              required
              value={form.clientId || ''}
              onChange={v => change('clientId', v)}
              options={clients.map(c => c.id + ':' + c.name)}
              emptyOption="Select a client"
            />
            <Field
              label="Service type"
              value={form.service || ''}
              onChange={v => change('service', v)}
              placeholder="Website development, automation…"
            />
            <div className="form-grid">
              <Field
                label="Budget (KES)"
                type="number"
                step={0.01}
                value={form.budget || ''}
                onChange={v => change('budget', v)}
                placeholder="0"
              />
              <Field
                label="Due date"
                type="date"
                value={form.dueDate || ''}
                onChange={v => change('dueDate', v)}
              />
            </div>
            <div className="form-grid">
              <Field
                label="Status"
                select
                value={form.status || 'Planning'}
                onChange={v => change('status', v)}
                options={['Planning', 'In Progress', 'On Hold', 'Completed']}
              />
              <Field
                label="Progress (%)"
                type="number"
                value={form.progress || '0'}
                onChange={v => change('progress', v)}
                placeholder="0"
              />
            </div>
          </>
        )}
        {kind === 'invoice' && (
          <>
            <Field
              label="Client"
              select
              required
              value={form.clientId || ''}
              onChange={v => change('clientId', v)}
              options={clients.map(c => c.id + ':' + c.name)}
              emptyOption="Select a client"
            />
            <div className="form-grid">
              <Field
                label="Invoice number"
                value={form.number || ''}
                onChange={v => change('number', v)}
                placeholder="Auto-generated if blank"
              />
              <Field
                label="Amount (KES)"
                type="number"
                step={0.01}
                required
                value={form.amount || ''}
                onChange={v => change('amount', v)}
                placeholder="0"
              />
            </div>
            <div className="form-grid">
              <Field
                label="Paid so far (KES)"
                type="number"
                step={0.01}
                value={form.paid || '0'}
                onChange={v => change('paid', v)}
                placeholder="0"
              />
              <Field
                label="Due date"
                type="date"
                value={form.dueDate || ''}
                onChange={v => change('dueDate', v)}
              />
            </div>
          </>
        )}        <div className="modal-actions">
          <button type="button" className="secondary" onClick={onClose}>
            Cancel
          </button>
          <button className="primary" disabled={saving}>
            {saving ? (
              'Saving…'
            ) : (
              <>
                <Check size={16} /> Save record
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
function Field({
  label,
  value,
  onChange,
  placeholder,
  type = 'text',
  required = false,
  select = false,
  options = [],
  emptyOption,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
  required?: boolean;
  select?: boolean;
  options?: string[];
  emptyOption?: string;
}) {
  return (
    <label className="field">
      <span>
        {label}
        {required && ' *'}
      </span>
      {select ? (
        <select
          required={required}
          value={value}
          onChange={e => onChange(e.target.value)}
        >
          <option value="">{emptyOption || 'Select an option'}</option>
          {options.map(o => {
            const [v, l] = o.includes(':') ? o.split(':') : [o, o];
            return (
              <option key={v} value={v}>
                {l}
              </option>
            );
          })}
        </select>
      ) : (
        <input
          required={required}
          type={type}
          min={type === 'number' ? 0 : undefined}
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder}
        />
      )}
    </label>
  );
}
export default App;
