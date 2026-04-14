<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

const route = useRoute()

const pluginID = computed(() => (typeof route.meta.pluginId === 'string' ? route.meta.pluginId : '-'))
const pageTitle = computed(() => (typeof route.meta.pluginTitle === 'string' ? route.meta.pluginTitle : '插件页面'))
const routePath = computed(() => route.path || '/')
const metaJSON = computed(() => {
  try {
    return JSON.stringify(route.meta.pluginMeta ?? {}, null, 2)
  } catch {
    return '{}'
  }
})
</script>

<template>
  <div class="space-y-6">
    <div>
      <h2 class="text-2xl font-bold tracking-tight">{{ pageTitle }}</h2>
      <p class="text-muted-foreground">当前页面已经由插件运行时登记，但宿主后台没有为它提供专门的前端实现。</p>
    </div>

    <Card>
      <CardHeader>
        <CardTitle>页面占位说明</CardTitle>
        <CardDescription>这说明插件路由已经挂载成功，只是前端视图还没有映射到宿主后台组件。</CardDescription>
      </CardHeader>
      <CardContent class="space-y-4 text-sm">
        <div class="grid gap-3 md:grid-cols-2">
          <div>
            <div class="text-muted-foreground">插件 ID</div>
            <div class="font-medium">{{ pluginID }}</div>
          </div>
          <div>
            <div class="text-muted-foreground">页面路由</div>
            <div class="font-medium">{{ routePath }}</div>
          </div>
        </div>

        <div class="space-y-2">
          <div class="text-muted-foreground">页面元数据</div>
          <pre class="overflow-x-auto rounded-lg border bg-muted/30 p-4 text-xs leading-6">{{ metaJSON }}</pre>
        </div>
      </CardContent>
    </Card>
  </div>
</template>
