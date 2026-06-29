import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { logActivity } from '../lib/activityLog'

export default function AdminPage() {
  const [users, setUsers] = useState([])
  const [activity, setActivity] = useState([])
  const [groups, setGroups] = useState([])
  const [members, setMembers] = useState([])
  const [eventFilter, setEventFilter] = useState('')
  const [message, setMessage] = useState('')

  async function refresh() {
    const [usersRes, activityRes, groupsRes, membersRes] = await Promise.all([
      supabase.from('profiles').select('*').order('created_at', { ascending: false }),
      supabase
        .from('activity_log')
        .select('*, profiles(display_name, email)')
        .order('created_at', { ascending: false })
        .limit(200),
      supabase.from('groups').select('*'),
      supabase.from('group_members').select('*'),
    ])

    setUsers(usersRes.data ?? [])
    setActivity(activityRes.data ?? [])
    setGroups(groupsRes.data ?? [])
    setMembers(membersRes.data ?? [])
  }

  useEffect(() => {
    refresh()
  }, [])

  async function deleteUser(user) {
    if (!window.confirm(`Delete user "${user.display_name}" (${user.email})? This cannot be undone.`)) {
      return
    }

    const { error } = await supabase.rpc('admin_delete_user', { target_user_id: user.id })
    if (error) {
      setMessage(error.message)
      return
    }

    await logActivity('admin_user_deleted', { target_user_id: user.id })
    setMessage(`User ${user.email} has been deleted.`)
    refresh()
  }

  async function sendPasswordReset(user) {
    const { error } = await supabase.auth.resetPasswordForEmail(user.email, {
      redirectTo: `${window.location.origin}/reset-password`,
    })

    if (error) {
      setMessage(error.message)
      return
    }

    await logActivity('admin_password_reset_triggered', { target_user_id: user.id })
    setMessage(`Password reset email sent to ${user.email}.`)
    refresh()
  }

  async function renameGroup(group) {
    const nextName = window.prompt('Rename group', group.name)
    if (!nextName || nextName.trim() === group.name) {
      return
    }

    await supabase.from('groups').update({ name: nextName.trim() }).eq('id', group.id)
    await logActivity('admin_group_updated', { group_id: group.id })
    refresh()
  }

  async function deleteGroup(group) {
    if (!window.confirm(`Delete group "${group.name}"? This cannot be undone.`)) {
      return
    }

    await supabase.from('groups').delete().eq('id', group.id)
    await logActivity('admin_group_deleted', { group_id: group.id })
    refresh()
  }

  const filteredActivity = eventFilter
    ? activity.filter((entry) => entry.event_type === eventFilter)
    : activity
  const eventTypes = [...new Set(activity.map((entry) => entry.event_type))]

  return (
    <section className="panel stack">
      <h2>Admin</h2>
      {message && <p className="error">{message}</p>}

      <div className="stack">
        <h3>Users</h3>
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Email</th>
              <th>Role</th>
              <th>Joined</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {users.map((user) => (
              <tr key={user.id}>
                <td>{user.display_name}</td>
                <td>{user.email}</td>
                <td>{user.role}</td>
                <td>{new Date(user.created_at).toLocaleString()}</td>
                <td>
                  <button type="button" onClick={() => sendPasswordReset(user)}>
                    Send password reset
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="stack">
        <h3>Activity feed</h3>
        <label>
          Filter by event type
          <select value={eventFilter} onChange={(event) => setEventFilter(event.target.value)}>
            <option value="">All events</option>
            {eventTypes.map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </select>
        </label>
        <table>
          <thead>
            <tr>
              <th>When</th>
              <th>User</th>
              <th>Event</th>
              <th>Metadata</th>
            </tr>
          </thead>
          <tbody>
            {filteredActivity.map((entry) => (
              <tr key={entry.id}>
                <td>{new Date(entry.created_at).toLocaleString()}</td>
                <td>{entry.profiles?.display_name ?? entry.profiles?.email ?? 'System'}</td>
                <td>{entry.event_type}</td>
                <td>{JSON.stringify(entry.metadata)}</td>
              </tr>
            ))}
            {filteredActivity.length === 0 && (
              <tr>
                <td colSpan="4">No activity recorded yet.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="stack">
        <h3>Groups</h3>
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Owner</th>
              <th>Members</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {groups.map((group) => {
              const owner = users.find((user) => user.id === group.owner_user_id)
              const memberCount = members.filter((member) => member.group_id === group.id).length

              return (
                <tr key={group.id}>
                  <td>{group.name}</td>
                  <td>{owner?.display_name ?? 'Unknown'}</td>
                  <td>{memberCount}</td>
                  <td>
                    <button type="button" onClick={() => renameGroup(group)}>
                      Rename
                    </button>
                    <button type="button" onClick={() => deleteGroup(group)}>
                      Delete
                    </button>
                  </td>
                </tr>
              )
            })}
            {groups.length === 0 && (
              <tr>
                <td colSpan="4">No groups yet.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  )
}
