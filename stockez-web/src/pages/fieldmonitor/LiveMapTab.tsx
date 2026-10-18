import React, { useMemo, useState } from 'react';
import { Alert, Empty, Spin, Table, Tag } from 'antd';
import { MapContainer, Marker, Polyline, Popup, TileLayer } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import dayjs from 'dayjs';
import {
  useGetLiveBoardQuery,
  useGetStaffDayQuery,
  type LiveStaff,
  type Visit,
} from '../../store/api/trackingApi';

const GREEN = '#059669';
const RED = '#dc2626';
const AMBER = '#d97706';
const GREY = '#94a3b8';
const SLATE = '#334155';

const OUTCOME_LABEL: Record<string, string> = {
  ORDER_PLACED: 'Order',
  COUNTER_SALE: 'Counter sale',
  PAYMENT_COLLECTED: 'Collection',
  DELIVERED: 'Delivered',
  NO_ORDER: 'No order',
  SHOP_CLOSED: 'Shop closed',
};

/**
 * Built with a div icon rather than Leaflet's default marker image: the stock icon ships as a PNG
 * resolved relative to the CSS, which bundlers rewrite and break. Drawing the pin inline avoids
 * that entirely and lets each marker carry its own colour and label.
 */
const pin = (color: string, label: string, dimmed = false) =>
  L.divIcon({
    className: '',
    html: `<div style="
      background:${color};opacity:${dimmed ? 0.55 : 1};color:#fff;
      width:26px;height:26px;border-radius:50% 50% 50% 0;
      transform:rotate(-45deg);border:2px solid #fff;
      box-shadow:0 1px 4px rgba(0,0,0,0.35);
      display:flex;align-items:center;justify-content:center;
      font-size:11px;font-weight:700;font-family:Inter,sans-serif;">
      <span style="transform:rotate(45deg)">${label}</span>
    </div>`,
    iconSize: [26, 26],
    iconAnchor: [13, 26],
  });

const lastSeenText = (s: LiveStaff) => {
  if (!s.lastSeenAt) return 'No position today';
  const mins = s.minutesSinceLastSeen ?? 0;
  if (mins < 2) return 'Just now';
  if (mins < 60) return `${mins} min ago`;
  return dayjs(s.lastSeenAt).format('h:mm A');
};

const VisitTable: React.FC<{ visits: Visit[] }> = ({ visits }) => {
  const columns = [
    {
      title: 'Time',
      dataIndex: 'visitedAt',
      width: 90,
      render: (v: string) => dayjs(v).format('h:mm A'),
    },
    {
      title: 'Shop',
      dataIndex: 'customerName',
      render: (v: string) => <span style={{ fontWeight: 600, color: '#0f172a' }}>{v}</span>,
    },
    {
      title: 'Outcome',
      dataIndex: 'outcome',
      width: 120,
      render: (v: string) => OUTCOME_LABEL[v] || v,
    },
    {
      title: 'Order #',
      dataIndex: 'orderNumber',
      width: 140,
      render: (v: string | null) =>
        v ? <span style={{ fontFamily: 'monospace', fontSize: 12 }}>{v}</span> : <span style={{ color: GREY }}>—</span>,
    },
    {
      title: 'Amount',
      dataIndex: 'orderAmount',
      width: 110,
      align: 'right' as const,
      render: (v: number | null) => (v != null ? `₹${Number(v).toFixed(2)}` : <span style={{ color: GREY }}>—</span>),
    },
    {
      title: 'At shop',
      key: 'location',
      width: 150,
      render: (_: unknown, r: Visit) => {
        if (r.locationStatus === 'VERIFIED') {
          return <span style={{ color: GREEN, fontWeight: 600 }}>Yes · {r.distanceFromShopM} m</span>;
        }
        if (r.locationStatus === 'FAR') {
          return <span style={{ color: RED, fontWeight: 600 }}>{(r.distanceFromShopM! / 1000).toFixed(1)} km away</span>;
        }
        if (r.locationStatus === 'NO_SHOP_PIN') {
          return <span style={{ color: GREY }}>Shop not pinned</span>;
        }
        return <span style={{ color: GREY }}>GPS off</span>;
      },
    },
    {
      title: 'Reason',
      dataIndex: 'reason',
      render: (v: string | null) => v || <span style={{ color: GREY }}>—</span>,
    },
  ];

  return (
    <Table
      columns={columns}
      dataSource={visits.map((v, i) => ({ ...v, key: v.id || i }))}
      size="small"
      pagination={false}
      locale={{ emptyText: 'No shop visits recorded' }}
    />
  );
};

const LiveMapTab: React.FC<{ date: string }> = ({ date }) => {
  const isToday = date === dayjs().format('YYYY-MM-DD');
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);

  const { data, isLoading } = useGetLiveBoardQuery(date, {
    pollingInterval: isToday ? 30000 : 0,
  });
  const board = data?.data;
  const staff = board?.staff ?? [];

  const { data: dayData } = useGetStaffDayQuery(
    { userId: selectedUserId!, date },
    { skip: !selectedUserId },
  );
  const staffDay = dayData?.data;

  const positioned = useMemo(
    () => staff.filter((s) => s.lastLatitude != null && s.lastLongitude != null),
    [staff],
  );

  const center = useMemo<[number, number] | null>(() => {
    const pts: [number, number][] = [];
    staffDay?.visits.forEach((v) => {
      if (v.latitude != null && v.longitude != null) pts.push([v.latitude, v.longitude]);
    });
    positioned.forEach((s) => pts.push([s.lastLatitude!, s.lastLongitude!]));
    if (!pts.length) return null;
    const lat = pts.reduce((a, p) => a + p[0], 0) / pts.length;
    const lng = pts.reduce((a, p) => a + p[1], 0) / pts.length;
    return [lat, lng];
  }, [positioned, staffDay]);

  const trailLine = useMemo<[number, number][]>(
    () => (staffDay?.trail ?? []).map((p) => [p.latitude, p.longitude]),
    [staffDay],
  );

  if (isLoading) {
    return <div style={{ textAlign: 'center', padding: 60 }}><Spin /></div>;
  }

  if (!board?.trackingEnabled) {
    return (
      <Alert
        type="info"
        showIcon
        message="Location tracking is turned off"
        description={
          <div style={{ fontSize: 13, lineHeight: 1.7 }}>
            Switch it on in <strong>Settings → Company Settings → Field Tracking</strong>. Staff
            phones only report a position once it is enabled, and nothing is recorded before that.
            <div style={{ marginTop: 8, color: SLATE }}>
              Tell your staff before enabling it — their position is recorded during working hours.
            </div>
          </div>
        }
      />
    );
  }

  const staffColumns = [
    {
      title: 'Staff',
      key: 'person',
      render: (_: unknown, r: LiveStaff) => (
        <div>
          <div style={{ fontWeight: 600, color: '#0f172a' }}>{r.fullName}</div>
          <div style={{ fontSize: 11, color: '#64748b' }}>
            {r.dutyRole}{r.routeName ? ` · ${r.routeName}` : ''}
          </div>
        </div>
      ),
    },
    {
      title: 'Last seen',
      key: 'lastSeen',
      width: 130,
      render: (_: unknown, r: LiveStaff) => (
        <div>
          <div style={{ color: r.stale ? GREY : GREEN, fontWeight: 600, fontSize: 12 }}>
            {lastSeenText(r)}
          </div>
          {r.stale && r.lastSeenAt && (
            <div style={{ fontSize: 10, color: GREY }}>phone locked</div>
          )}
        </div>
      ),
    },
    {
      title: 'Shops',
      key: 'shops',
      width: 90,
      align: 'right' as const,
      render: (_: unknown, r: LiveStaff) => (
        <span style={{ fontWeight: 600 }}>
          {r.shopsVisited}{r.shopsOnRoute ? ` / ${r.shopsOnRoute}` : ''}
        </span>
      ),
    },
    {
      title: 'Orders',
      dataIndex: 'ordersPlaced',
      width: 70,
      align: 'right' as const,
    },
    {
      title: 'At shop',
      key: 'verified',
      width: 90,
      align: 'right' as const,
      render: (_: unknown, r: LiveStaff) => <span style={{ color: GREEN }}>{r.verifiedAtShop}</span>,
    },
    {
      title: 'Flagged',
      key: 'flagged',
      width: 80,
      align: 'right' as const,
      render: (_: unknown, r: LiveStaff) =>
        r.flaggedFarFromShop > 0
          ? <span style={{ color: RED, fontWeight: 700 }}>{r.flaggedFarFromShop}</span>
          : <span style={{ color: GREY }}>0</span>,
    },
  ];

  return (
    <div>
      {isToday && (
        <div style={{ fontSize: 12, color: '#64748b', marginBottom: 10 }}>
          Refreshing every 30 seconds. A grey marker means the phone is locked or the app is in the
          background — Android stops a web page reporting at that point, so it does not mean the
          staff member has stopped working. Each shop visit below is stamped independently.
        </div>
      )}

      <Table
        columns={staffColumns}
        dataSource={staff.map((s) => ({ ...s, key: s.userId }))}
        size="middle"
        pagination={false}
        locale={{ emptyText: 'Nobody is allocated to a route on this date' }}
        onRow={(record) => ({
          onClick: () => setSelectedUserId(record.userId === selectedUserId ? null : record.userId),
          style: {
            cursor: 'pointer',
            background: record.userId === selectedUserId ? '#f0fdf4' : undefined,
          },
        })}
      />

      <div style={{ marginTop: 16, border: '1px solid #e2e8f0', borderRadius: 8, overflow: 'hidden' }}>
        {center ? (
          <MapContainer center={center} zoom={13} style={{ height: 420, width: '100%' }}>
            <TileLayer
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            />

            {trailLine.length > 1 && (
              <Polyline positions={trailLine} pathOptions={{ color: GREEN, weight: 3, opacity: 0.6 }} />
            )}

            {staffDay?.visits.map((v) =>
              v.latitude != null && v.longitude != null ? (
                <Marker
                  key={v.id}
                  position={[v.latitude, v.longitude]}
                  icon={pin(v.locationStatus === 'FAR' ? RED : GREEN, '')}
                >
                  <Popup>
                    <div style={{ fontSize: 12, minWidth: 180 }}>
                      <div style={{ fontWeight: 700 }}>{v.customerName}</div>
                      <div>{OUTCOME_LABEL[v.outcome] || v.outcome} · {dayjs(v.visitedAt).format('h:mm A')}</div>
                      {v.orderNumber && <div style={{ fontFamily: 'monospace' }}>{v.orderNumber}</div>}
                      {v.locationStatus === 'VERIFIED' && (
                        <div style={{ color: GREEN }}>{v.distanceFromShopM} m from shop</div>
                      )}
                      {v.locationStatus === 'FAR' && (
                        <div style={{ color: RED, fontWeight: 600 }}>
                          {(v.distanceFromShopM! / 1000).toFixed(1)} km from the shop pin
                        </div>
                      )}
                    </div>
                  </Popup>
                </Marker>
              ) : null,
            )}

            {positioned.map((s) => (
              <Marker
                key={s.userId}
                position={[s.lastLatitude!, s.lastLongitude!]}
                icon={pin(s.stale ? GREY : AMBER, s.fullName.charAt(0).toUpperCase(), s.stale)}
                zIndexOffset={1000}
              >
                <Popup>
                  <div style={{ fontSize: 12 }}>
                    <div style={{ fontWeight: 700 }}>{s.fullName}</div>
                    <div>{s.dutyRole}{s.routeName ? ` · ${s.routeName}` : ''}</div>
                    <div>{lastSeenText(s)}</div>
                    <div>{s.shopsVisited} shop(s) visited</div>
                  </div>
                </Popup>
              </Marker>
            ))}
          </MapContainer>
        ) : (
          <div style={{ padding: 40 }}>
            <Empty
              description={
                <span style={{ fontSize: 13, color: '#64748b' }}>
                  No positions recorded on this date. Staff phones report once they open the app
                  with location permission allowed.
                </span>
              }
            />
          </div>
        )}
      </div>

      {selectedUserId && staffDay && (
        <div style={{ marginTop: 20 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 }}>
            {staffDay.fullName} — {staffDay.shopsVisited} shop(s) visited
            {staffDay.shopsOnRoute ? ` of ${staffDay.shopsOnRoute} on route` : ''}
            {staffDay.flaggedFarFromShop > 0 && (
              <Tag color="red" style={{ marginLeft: 8, fontSize: 10 }}>
                {staffDay.flaggedFarFromShop} flagged
              </Tag>
            )}
          </div>
          <VisitTable visits={staffDay.visits} />
        </div>
      )}
    </div>
  );
};

export default LiveMapTab;
