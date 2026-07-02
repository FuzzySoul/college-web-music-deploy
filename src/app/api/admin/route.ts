import { NextRequest, NextResponse } from 'next/server';
import { cacheFetch, cacheInvalidate } from '@/lib/cache-fetch';
import { getServiceSupabaseOrThrow } from '@/lib/supabase-service';

function getSupabase() {
  return getServiceSupabaseOrThrow();
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { username, password, action, table, data } = body;
    const supabase = getSupabase();
    if (!supabase) {
      return NextResponse.json({ error: 'Supabase未配置' }, { status: 500 });
    }

    if (action === 'login') {
      const { data: allData } = await supabase.from('admin_users').select('*');
      const { data: adminData, error } = await supabase
        .from('admin_users')
        .select('*')
        .eq('username', username)
        .eq('password_hash', password)
        .eq('is_active', true)
        .single();

      if (error || !adminData) {
        return NextResponse.json({ error: '用户名或密码错误' }, { status: 401 });
      }

      await supabase.from('admin_users').update({ last_login_at: new Date().toISOString() }).eq('id', adminData.id);

      return NextResponse.json({
        success: true,
        admin: { id: adminData.id, username: adminData.username, role: adminData.role }
      });
    }

    if (action === 'create') {
      if (!table || !data) {
        return NextResponse.json({ error: '缺少参数' }, { status: 400 });
      }

      const validTables = ['users', 'artists', 'albums', 'tracks', 'playlists'];
      if (!validTables.includes(table)) {
        return NextResponse.json({ error: '无效的表' }, { status: 400 });
      }

      const insertData: Record<string, any> = {};
      switch (table) {
        case 'users':
          insertData.email = data.email;
          insertData.username = data.username;
          insertData.role = data.role || 'user';
          if (data.avatar_url) insertData.avatar_url = data.avatar_url;
          break;
        case 'artists':
          insertData.name = data.name;
          if (data.alias) insertData.alias = data.alias;
          if (data.image) insertData.image = data.image;
          if (data.description) insertData.description = data.description;
          break;
        case 'albums':
          insertData.name = data.name;
          if (data.artist) insertData.artist = data.artist;
          if (data.coverUrl) insertData.coverUrl = data.coverUrl;
          if (data.year) insertData.year = data.year;
          break;
        case 'tracks':
          insertData.title = data.title;
          if (data.artist) insertData.artist = data.artist;
          if (data.album) insertData.album = data.album;
          if (data.cover) insertData.cover = data.cover;
          if (data.duration) insertData.duration = data.duration;
          if (data.source) insertData.source = data.source;
          if (data.source_id) insertData.source_id = data.source_id;
          if (data.play_url) insertData.play_url = data.play_url;
          if (data.audio_url) insertData.audio_url = data.audio_url;
          if (data.lyrics) insertData.lyrics = data.lyrics;
          if (data.mv_url) insertData.mv_url = data.mv_url;
          if (data.mv_cover) insertData.mv_cover = data.mv_cover;
          break;
        case 'playlists':
          insertData.name = data.name;
          if (data.description) insertData.description = data.description;
          if (data.cover) insertData.cover = data.cover;
          insertData.is_public = data.is_public !== undefined ? data.is_public : true;
          // 演示用：未指定 user_id 时回填 FuzzySoul（确保创建者字段可显示）
          insertData.user_id = data.user_id || '74c01886-b257-462e-abf9-f7491d25d0f2';
          break;
      }

      const { data: newData, error } = await supabase.from(table).insert(insertData).select().single();

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 400 });
      }

      await cacheInvalidate([`admin:${table}`, table, 'admin:stats', 'home']);
      return NextResponse.json({ success: true, data: newData });
    }

    return NextResponse.json({ error: '无效的操作' }, { status: 400 });
  } catch (error) {
    console.error('Admin API error:', error);
    return NextResponse.json({ error: '服务器错误' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { table, id, data } = body;
    const supabase = getSupabase();
    if (!supabase) {
      return NextResponse.json({ error: 'Supabase未配置' }, { status: 500 });
    }

    if (!table || !id || !data) {
      return NextResponse.json({ error: '缺少参数' }, { status: 400 });
    }

    const validTables = ['users', 'artists', 'albums', 'tracks', 'playlists'];
    if (!validTables.includes(table)) {
      return NextResponse.json({ error: '无效的表' }, { status: 400 });
    }

    const updateData: Record<string, any> = {};
    switch (table) {
      case 'users':
        if (data.email !== undefined) updateData.email = data.email;
        if (data.username !== undefined) updateData.username = data.username;
        if (data.role !== undefined) updateData.role = data.role;
        if (data.avatar_url !== undefined) updateData.avatar_url = data.avatar_url;
        break;
      case 'artists':
        if (data.name !== undefined) updateData.name = data.name;
        if (data.alias !== undefined) updateData.alias = data.alias;
        if (data.image !== undefined) updateData.image = data.image;
        if (data.description !== undefined) updateData.description = data.description;
        break;
      case 'albums':
          if (data.name !== undefined) updateData.name = data.name;
          if (data.artist !== undefined) updateData.artist = data.artist;
          if (data.cover !== undefined) updateData.cover = data.cover;
          else if (data.coverUrl !== undefined) updateData.cover = data.coverUrl;
          if (data.year !== undefined) updateData.year = data.year;
          break;
      case 'tracks':
        if (data.title !== undefined) updateData.title = data.title;
        if (data.artist !== undefined) updateData.artist = data.artist;
        if (data.album !== undefined) updateData.album = data.album;
        if (data.cover !== undefined) updateData.cover = data.cover;
        if (data.duration !== undefined) updateData.duration = data.duration;
        if (data.lyrics !== undefined) updateData.lyrics = data.lyrics;
        if (data.mv_url !== undefined) updateData.mv_url = data.mv_url;
        if (data.mv_cover !== undefined) updateData.mv_cover = data.mv_cover;
        break;
      case 'playlists':
        if (data.name !== undefined) updateData.name = data.name;
        if (data.description !== undefined) updateData.description = data.description;
        if (data.cover !== undefined) updateData.cover = data.cover;
        if (data.is_public !== undefined) updateData.is_public = data.is_public;
        break;
    }

    const idField = table === 'tracks' ? parseInt(id) : id;
    const { data: updatedData, error } = await supabase.from(table).update(updateData).eq('id', idField).select().single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    await cacheInvalidate([`admin:${table}`, table, 'admin:stats', 'home']);
    return NextResponse.json({ success: true, data: updatedData });
  } catch (error) {
    console.error('Admin API error:', error);
    return NextResponse.json({ error: '服务器错误' }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const table = searchParams.get('table');
    const includeAuth = searchParams.get('includeAuth');
    const search = searchParams.get('search');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '50');
    const from = (page - 1) * limit;
    const to = from + limit - 1;

    const supabase = getSupabase();
    if (!supabase) {
      return NextResponse.json({ error: 'Supabase未配置' }, { status: 500 });
    }

    if (table === 'users' && includeAuth === 'true') {
      const { data: dbUsers, error: dbError } = await supabase
        .from('users')
        .select('*')
        .order('created_at', { ascending: false });

      if (dbError) {
        return NextResponse.json({ error: dbError.message }, { status: 400 });
      }

      const { data: authUsers } = await supabase.auth.admin.listUsers();
      let mergedUsers: any[] = [];

      if (authUsers?.users) {
        const authUserMap = new Map();
        authUsers.users.forEach((user: any) => {
          const merged = {
            id: user.id,
            email: user.email,
            username: user.email?.split('@')[0] || '未知',
            role: 'user',
            created_at: user.created_at,
            email_confirmed_at: user.email_confirmed_at,
            source: 'auth'
          };
          authUserMap.set(user.id, merged);
        });

        if (dbUsers) {
          dbUsers.forEach((dbUser: any) => {
            if (authUserMap.has(dbUser.id)) {
              const authUser = authUserMap.get(dbUser.id);
              authUserMap.set(dbUser.id, {
                ...authUser,
                username: dbUser.username || authUser.username,
                role: dbUser.role || 'user',
                avatar_url: dbUser.avatar_url,
                source: 'both'
              });
            } else {
              authUserMap.set(dbUser.id, { ...dbUser, source: 'db' });
            }
          });
        }
        mergedUsers = Array.from(authUserMap.values());
      } else {
        mergedUsers = dbUsers || [];
      }

      if (search) {
        const q = search.toLowerCase();
        mergedUsers = mergedUsers.filter((u: any) =>
          (u.username || '').toLowerCase().includes(q) ||
          (u.email || '').toLowerCase().includes(q)
        );
      }

      const total = mergedUsers.length;
      const paginatedData = mergedUsers.slice(from, to + 1);
      return NextResponse.json({
        data: paginatedData,
        pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
        source: 'merged'
      });
    }

    const cacheParams: Record<string, string> = { page: String(page), limit: String(limit) };
    if (search) cacheParams.search = search;
    const cached = await cacheFetch('/api/cache/admin/' + table, cacheParams);
    if (cached) {
      if (table === 'comments' && cached.data) {
        const mappedData = cached.data.map((c: any) => ({
          id: c.id,
          content: c.content,
          userId: c.user_id,
          username: c.username,
          targetType: c.target_type,
          targetId: c.target_id,
          parentId: c.parent_id,
          createdAt: c.created_at,
          updatedAt: c.updated_at,
          isDeleted: c.is_deleted,
        }));
        return NextResponse.json({ data: mappedData, pagination: cached.pagination });
      }
      return NextResponse.json(cached);
    }

    let query;
    if (table === 'playlists') {
      query = supabase.from('playlists').select('id, name, description, is_public, platform_source, external_playlist_id, platform_playlist_id, created_at', { count: 'exact' });
    } else if (table === 'external_playlists') {
      query = supabase.from('external_playlists').select('id, name, cover_url, track_count, platform_id, platform_playlist_id, created_at', { count: 'exact' });
    } else {
      query = supabase.from(table || '').select('*', { count: 'exact' });
    }

    if (search) {
      switch (table) {
        case 'artists':
          query = query.or(`name.ilike.%${search}%,alias.ilike.%${search}%`);
          break;
        case 'albums':
          query = query.or(`name.ilike.%${search}%,artist.ilike.%${search}%`);
          break;
        case 'tracks':
          query = query.or(`title.ilike.%${search}%,artist.ilike.%${search}%,album.ilike.%${search}%`);
          break;
        case 'playlists':
          query = query.or(`name.ilike.%${search}%,description.ilike.%${search}%`);
          break;
        case 'comments':
          query = query.or(`content.ilike.%${search}%,username.ilike.%${search}%`);
          break;
      }
    }

    if (table === 'users') query = query.order('created_at', { ascending: false });
    else if (table === 'tracks') query = query.order('id', { ascending: false });
    else if (table === 'artists') query = query.order('created_at', { ascending: false });
    else if (table === 'playlists') query = query.order('created_at', { ascending: false });
    else if (table === 'comments') query = query.order('created_at', { ascending: false });

    const { data, error, count } = await query.range(from, to);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    let mappedData = data;
    if (table === 'comments' && data) {
      mappedData = data.map((c: any) => ({
        id: c.id,
        content: c.content,
        userId: c.user_id,
        username: c.username,
        targetType: c.target_type,
        targetId: c.target_id,
        parentId: c.parent_id,
        createdAt: c.created_at,
        updatedAt: c.updated_at,
        isDeleted: c.is_deleted,
      }));
    }

    return NextResponse.json({
      data: mappedData,
      pagination: { page, limit, total: count || 0, totalPages: Math.ceil((count || 0) / limit) }
    });
  } catch (error) {
    console.error('Admin API error:', error);
    return NextResponse.json({ error: '服务器错误' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const table = searchParams.get('table');
    const id = searchParams.get('id');

    if (!table || !id) {
      return NextResponse.json({ error: '缺少参数' }, { status: 400 });
    }

    const supabase = getSupabase();
    if (!supabase) {
      return NextResponse.json({ error: 'Supabase未配置' }, { status: 500 });
    }

    let result;
    switch (table) {
      case 'users':
        result = await supabase.from('users').delete().eq('id', id);
        break;
      case 'artists':
        result = await supabase.from('artists').delete().eq('id', id);
        break;
      case 'albums':
        result = await supabase.from('albums').delete().eq('id', id);
        break;
      case 'tracks':
        result = await supabase.from('tracks').delete().eq('id', parseInt(id));
        break;
      case 'playlists':
        result = await supabase.from('playlists').delete().eq('id', id);
        break;
      case 'comments':
        result = await supabase.from('comments').delete().eq('id', parseInt(id));
        break;
      default:
        return NextResponse.json({ error: '无效的表' }, { status: 400 });
    }

    if (result.error) {
      return NextResponse.json({ error: result.error.message }, { status: 400 });
    }

    await cacheInvalidate([`admin:${table}`, table, 'admin:stats', 'home']);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Admin API error:', error);
    return NextResponse.json({ error: '服务器错误' }, { status: 500 });
  }
}
