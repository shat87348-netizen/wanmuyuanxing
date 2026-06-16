<template>
  <div class="user">
    <UiRow :gutter="16" class="stats-row">
      <UiCol :xs="24" :sm="12" :md="6">
        <UiCard class="stat-card">
          <UiStatistic title="用户总数" :value="stats.totalUser" :value-style="{ color: '#8ABBDB' }">
            <template #prefix><UserOutlined /></template>
          </UiStatistic>
        </UiCard>
      </UiCol>
      <UiCol :xs="24" :sm="12" :md="6">
        <UiCard class="stat-card">
          <UiStatistic title="活跃用户" :value="stats.activeUser" :value-style="{ color: '#45AD8D' }">
            <template #prefix><TeamOutlined /></template>
          </UiStatistic>
        </UiCard>
      </UiCol>
      <UiCol :xs="24" :sm="12" :md="6">
        <UiCard class="stat-card">
          <UiStatistic title="管理员" :value="stats.adminCount" :value-style="{ color: '#ECBE84' }">
            <template #prefix><SafetyOutlined /></template>
          </UiStatistic>
        </UiCard>
      </UiCol>
      <UiCol :xs="24" :sm="12" :md="6">
        <UiCard class="stat-card">
          <UiStatistic title="普通用户" :value="stats.userCount" :value-style="{ color: '#8ABBDB' }">
            <template #prefix><LockOutlined /></template>
          </UiStatistic>
        </UiCard>
      </UiCol>
    </UiRow>

    <UiCard title="用户列表" class="data-card">
      <template #extra>
        <UiButton type="primary" @click="showAddUserModal">新增用户</UiButton>
      </template>
      <UiTable :columns="userColumns" :data-source="users" :loading="loading" row-key="id">
        <template #bodyCell="{ column, record }">
          <template v-if="column.key === 'status'">
            <UiTag :color="record.status === 'ACTIVE' ? 'success' : 'default'">{{ record.status === 'ACTIVE' ? '启用' : '禁用' }}</UiTag>
          </template>
          <template v-if="column.key === 'role'">
            <UiTag :color="getRoleColor(record.role)">{{ getRoleName(record.role) }}</UiTag>
          </template>
          <template v-if="column.key === 'action'">
            <UiSpace>
              <UiButton type="link" size="small" @click="editUser(record)">编辑</UiButton>
              <UiPopconfirm title="确定删除此用户?" @confirm="deleteUser(record.id)" ok-text="确定" cancel-text="取消">
                <UiButton type="link" size="small" danger>删除</UiButton>
              </UiPopconfirm>
            </UiSpace>
          </template>
        </template>
      </UiTable>
    </UiCard>

    <!-- 用户弹窗 -->
    <UiModal :visible="userModalVisible" :title="isEditingUser ? '编辑用户' : '新增用户'" @ok="saveUser" @cancel="closeUserModal">
      <UiForm :model="userForm" layout="vertical">
        <UiFormItem label="用户名" required>
          <UiInput v-model:value="userForm.username" placeholder="请输入用户名" />
        </UiFormItem>
        <UiFormItem label="密码" :required="!isEditingUser">
          <UiInput v-model:value="userForm.password" type="password" placeholder="请输入密码" />
        </UiFormItem>
        <UiFormItem label="真实姓名">
          <UiInput v-model:value="userForm.realName" placeholder="请输入真实姓名" />
        </UiFormItem>
        <UiFormItem label="角色" required>
          <UiSelect v-model:value="userForm.role" placeholder="请选择角色">
            <UiSelectOption value="SUPER_ADMIN">超级管理员</UiSelectOption>
            <UiSelectOption value="MODEL_ADMIN">型号管理员</UiSelectOption>
            <UiSelectOption value="USER">普通用户</UiSelectOption>
          </UiSelect>
        </UiFormItem>
        <UiFormItem label="状态">
          <UiSelect v-model:value="userForm.status">
            <UiSelectOption value="ACTIVE">启用</UiSelectOption>
            <UiSelectOption value="INACTIVE">禁用</UiSelectOption>
          </UiSelect>
        </UiFormItem>
        <UiFormItem label="邮箱">
          <UiInput v-model:value="userForm.email" placeholder="请输入邮箱" />
        </UiFormItem>
        <UiFormItem label="电话">
          <UiInput v-model:value="userForm.phone" placeholder="请输入电话" />
        </UiFormItem>
      </UiForm>
    </UiModal>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import { userApi } from '../api'
import { message } from '../utils/feedback'

const loading = ref(false)
const userModalVisible = ref(false)
const isEditingUser = ref(false)

const userForm = reactive({
  id: null,
  username: '',
  password: '',
  realName: '',
  role: 'USER',
  status: 'ACTIVE',
  email: '',
  phone: ''
})

const stats = ref({
  totalUser: 0,
  activeUser: 0,
  adminCount: 0,
  userCount: 0
})

const users = ref([])

const userColumns = [
  { title: '用户名', dataIndex: 'username' },
  { title: '真实姓名', dataIndex: 'realName' },
  { title: '角色', key: 'role' },
  { title: '状态', key: 'status' },
  { title: '邮箱', dataIndex: 'email' },
  { title: '电话', dataIndex: 'phone' },
  { title: '操作', key: 'action', width: 150 }
]

const getRoleColor = (role) => {
  const colors = {
    'SUPER_ADMIN': 'red',
    'MODEL_ADMIN': 'orange',
    'ADMIN': 'red',
    'USER': 'blue'
  }
  return colors[role] || 'default'
}

const getRoleName = (role) => {
  const names = {
    'SUPER_ADMIN': '超级管理员',
    'MODEL_ADMIN': '型号管理员',
    'ADMIN': '管理员',
    'USER': '普通用户'
  }
  return names[role] || role
}

const loadUsers = async () => {
  loading.value = true
  try {
    const res = await userApi.getList()
    if (res.data) {
      users.value = res.data.data || res.data || []
      stats.value.totalUser = users.value.length
      stats.value.activeUser = users.value.filter(u => u.status === 'ACTIVE').length
      stats.value.adminCount = users.value.filter(u => u.role === 'ADMIN' || u.role === 'SUPER_ADMIN').length
      stats.value.userCount = users.value.filter(u => u.role === 'USER' || u.role === 'MODEL_ADMIN').length
    }
  } catch (error) {
    console.error('Failed to load users:', error)
    message.error('加载用户列表失败，请检查登录状态')
    users.value = []
  } finally {
    loading.value = false
  }
}

const showAddUserModal = () => {
  isEditingUser.value = false
  userForm.id = null
  userForm.username = ''
  userForm.password = ''
  userForm.realName = ''
  userForm.role = 'USER'
  userForm.status = 'ACTIVE'
  userForm.email = ''
  userForm.phone = ''
  userModalVisible.value = true
}

const editUser = (record) => {
  isEditingUser.value = true
  userForm.id = record.id
  userForm.username = record.username
  userForm.password = ''
  userForm.realName = record.realName
  userForm.role = record.role
  userForm.status = record.status
  userForm.email = record.email
  userForm.phone = record.phone
  userModalVisible.value = true
}

const closeUserModal = () => {
  userModalVisible.value = false
}

const saveUser = async () => {
  if (!userForm.username) {
    message.error('请填写用户名')
    return
  }

  try {
    if (isEditingUser.value) {
      await userApi.update(userForm)
      message.success('用户更新成功')
    } else {
      await userApi.add(userForm)
      message.success('用户添加成功')
    }
    closeUserModal()
    loadUsers()
  } catch (error) {
    message.error('操作失败: ' + (error.response?.data?.message || error.message))
  }
}

const deleteUser = async (id) => {
  try {
    await userApi.delete(id)
    message.success('删除成功')
    loadUsers()
  } catch (error) {
    message.error('删除失败')
  }
}

onMounted(() => {
  loadUsers()
})
</script>

<style scoped>
.stats-row { margin-bottom: 16px; }
.stat-card, .data-card {
  background: rgba(255, 255, 255, 0.05) !important;
  border: 1px solid rgba(255,255,255,0.15) !important;
  border-radius: 4px !important;
}
</style>
