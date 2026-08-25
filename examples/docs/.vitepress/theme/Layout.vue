<script setup lang="ts">
import DefaultTheme from 'vitepress/theme'
import { useCopyTex, useTemmlRefs } from 'vitepress-plugin-math/client'

useCopyTex()
useTemmlRefs()
</script>

<template>
  <DefaultTheme.Layout />
</template>
